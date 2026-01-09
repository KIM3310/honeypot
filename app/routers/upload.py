from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form, Depends, Request
from app.auth import get_current_user
from app.routers.auth import verify_csrf_token
from app.services.blob_service import upload_to_blob, save_processed_json
from app.services.document_service import extract_text_from_url, extract_text_from_docx
from app.services.search_service import add_document_to_index, get_document_count, get_all_documents
import uuid
import traceback
from app.state import task_manager
from app.services.openai_service import analyze_text_for_search
from app.services.search_service import index_processed_chunks
import json

router = APIRouter()

"""
@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        # 1. 파일 데이터 읽기
        file_data = await file.read()
        
        # 2. 파일 확장자 확인
        file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
        
        # 3. txt 파일은 직접 텍스트 추출, PDF/이미지는 Document Intelligence 사용
        if file_ext == 'txt':
            # txt 파일은 직접 디코딩
            try:
                extracted_text = file_data.decode('utf-8')
            except UnicodeDecodeError:
                extracted_text = file_data.decode('cp949', errors='ignore')
        else:
            # PDF, 이미지 등은 Blob 업로드 후 Document Intelligence 사용
            try:
                print(f"📤 Blob 업로드 시도: {file.filename}")
                blob_url = upload_to_blob(file.filename, file_data)
                print(f"✅ Blob 업로드 완료: {blob_url}")
                
                print(f"🔍 Document Intelligence로 텍스트 추출 시작...")
                extracted_text = extract_text_from_url(blob_url)
                print(f"✅ 텍스트 추출 완료 ({len(extracted_text)} 글자)")
            except Exception as doc_error:
                print(f"⚠️  Document Intelligence 실패: {doc_error}")
                # Document Intelligence 실패 시 파일명과 기본 메시지로 폴백
                extracted_text = f"[파일명: {file.filename}]\n[주의: 자동 텍스트 추출 실패. Document Intelligence 설정 필요]\n\n파일을 텍스트로 변환하여 업로드해주세요."
        
        # 4. AI Search에 인덱싱 (실패해도 텍스트는 반환)
        doc_id = str(uuid.uuid4())
        try:
            add_document_to_index(doc_id, extracted_text, file.filename)
            print(f"✅ AI Search 인덱싱 완료")
        except Exception as index_error:
            print(f"⚠️  AI Search 인덱싱 실패 (계속 진행): {index_error}")
        
        return {
            "message": "문서 업로드 완료",
            "file_name": file.filename,
            "doc_id": doc_id,
            "extracted_text": extracted_text
        }
    except Exception as e:
        print(f"❌ Upload error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")
"""

#창훈 코드 추가

async def process_file_background(task_id: str, file_name: str, file_data: bytes, file_ext: str, index_name: str = None):
    """
    백그라운드에서 실행될 실제 파이프라인 로직
    1. Blob 업로드 (Raw)
    2. 텍스트 추출
    3. LLM 전처리 (JSON 생성)
    4. Blob 업로드 (Processed JSON)
    5. Azure Search 인덱싱

    Args:
        index_name: RAG 인덱스 이름 (지정하지 않으면 기본 인덱스 사용)
    """
    try:
        print(f"[Background] Processing task {task_id} for file {file_name}...")
        task_manager.update_task(task_id, status="processing", progress=10, message=f"Uploading raw file: {file_name}")
        
        # 1. Blob 업로드 (Raw)
        # 중요: 파일명에 한글/특수문자/공백이 있으면 Document Intelligence가 URL 다운로드에 실패함.
        # 따라서 Blob 저장 시에는 안전한 영문 이름(Task ID)을 사용하고, 원본 파일명은 메타데이터로만 관리함.
        safe_file_name = f"{task_id}.{file_ext}" if file_ext else task_id

        try:
            # upload_to_blob은 이미 SAS Token이 포함된 URL을 반환함
            blob_url_with_sas = upload_to_blob(safe_file_name, file_data, index_name=index_name)
            print(f"[Background] Blob upload success: {blob_url_with_sas}")
            
        except Exception as e:
            print(f"[Background] Blob upload failed: {e}")
            raise e

        task_manager.update_task(task_id, progress=30, message="Extracting text...")
        
        # 2. 텍스트 추출
        extracted_text = ""
        if file_ext in ['txt', 'py', 'js', 'java', 'c', 'cpp', 'h', 'cs', 'ts', 'tsx', 'html', 'css', 'json', 'md']:
            # 텍스트/코드 파일은 직접 디코딩
            try:
                extracted_text = file_data.decode('utf-8')
            except UnicodeDecodeError:
                extracted_text = file_data.decode('cp949', errors='ignore')
        elif file_ext == 'docx':
            # DOCX 로컬 추출 (빠르고 무료, URL 에러 없음)
            print("[Background] File is DOCX. Attempting local extraction...")
            try:
                extracted_text = extract_text_from_docx(file_data)
                print(f"[Background] DOCX extraction success. Length: {len(extracted_text)}")
            except Exception as e:
                print(f"[Background] DOCX extraction failed: {e}")
                task_manager.update_task(task_id, status="failed", message=f"DOCX extraction failed: {str(e)}")
                return
        else:
            # PDF, 이미지 등은 Document Intelligence 사용 (SAS Token 포함 URL 사용)
            try:
                extracted_text = extract_text_from_url(blob_url_with_sas)
            except Exception as e:
                task_manager.update_task(task_id, status="failed", message=f"Text extraction failed: {str(e)}")
                return

        if not extracted_text:
            task_manager.update_task(task_id, status="failed", message="No text extracted from file.")
            return
            
        task_manager.update_task(task_id, progress=50, message="Analyzing with AI (Preprocessing)...")
        print("[Background] Starting LLM analysis...")

        # 3. LLM 전처리
        # 파일 유형 구분 (code vs doc)
        file_type = "code" if file_ext in ['py', 'js', 'java', 'cpp', 'ts', 'tsx', 'cs'] else "doc"
        
        # print(f"extracted_text : {extracted_text}")
        chunks = analyze_text_for_search(extracted_text, file_name, file_type=file_type)
        print(f"[Background] LLM analysis returned {len(chunks) if chunks else 0} chunks.")
        
        if not chunks:
            task_manager.update_task(task_id, status="failed", message="AI preprocessing failed (No chunks generated).")
            return

        task_manager.update_task(task_id, progress=70, message="Saving processed data...")

        # 4. Processed JSON 저장 (Blob)
        # JSON 파일명도 안전하게 Task ID 기반으로 저장
        processed_file_name = f"{task_id}_processed.json"
        try:
            json_str = json.dumps(chunks, ensure_ascii=False, indent=2)
            save_processed_json(processed_file_name, json_str, index_name=index_name)
        except Exception as e:
            print(f"⚠️ Failed to save processed json: {e}")
            # 저장은 실패해도 진행

        task_manager.update_task(task_id, progress=80, message="Indexing to Search...")

        # 5. Azure Search 인덱싱
        print(f"[Background] Starting indexing for {len(chunks)} chunks to index '{index_name or 'default'}'...")
        try:
            indexed_count = index_processed_chunks(chunks, index_name=index_name)
            print(f"[Background] Indexing complete. Count: {indexed_count}")
        except Exception as e:
            print(f"[Background] Indexing failed: {e}")
            raise e
        
        if indexed_count > 0:
            task_manager.update_task(task_id, status="completed", progress=100, message="Upload & Indexing Complete!")
        else:
            task_manager.update_task(task_id, status="completed_with_warning", progress=100, message="Finished, but no documents indexed.")

    except Exception as e:
        print(f"❌ Background task failed: {e}")
        traceback.print_exc()
        task_manager.update_task(task_id, status="failed", message=f"Internal Server Error: {str(e)}")


@router.post("")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    index_name: str = Form(None),
    user: dict = Depends(get_current_user)
):
    # CSRF 검증 추가
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        raise HTTPException(
            status_code=403,
            detail="CSRF Token이 필요합니다."
        )
    verify_csrf_token(csrf_token, user['email'])
    """
    파일 업로드 엔드포인트 (비동기 처리)
    파일을 받자마자 task_id를 리턴하고, 백그라운드에서 처리 시작.

    Args:
        file: 업로드할 파일
        index_name: RAG 인덱스 이름 (선택 사항, 지정하지 않으면 기본 인덱스)
    """
    try:
        # 1. 파일 데이터 읽기 (메모리)
        file_data = await file.read()
        file_name = file.filename
        file_ext = file_name.lower().split('.')[-1] if '.' in file_name else ''

        # 2. Task 생성
        task_id = str(uuid.uuid4())
        task_manager.create_task(task_id)

        # 3. 백그라운드 작업 등록
        print(f"📋 Upload request: file={file_name}, index={index_name or 'default'}")
        background_tasks.add_task(process_file_background, task_id, file_name, file_data, file_ext, index_name)

        return {
            "message": "Upload started",
            "task_id": task_id,
            "file_name": file_name,
            "index_name": index_name or "default"
        }
        
    except Exception as e:
        print(f"❌ Upload request failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """백그라운드 작업 상태 조회"""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task



@router.get("/stats")
async def get_stats(index_name: str = "documents-index"):
    """시스템 통계 조회 - 최근 업로드 갯수, 인덱스 문서 갯수"""
    try:
        doc_count = get_document_count(index_name)
        print(f"📊 시스템 통계: {doc_count}개 문서 인덱싱됨")
        
        return {
            "total_documents": doc_count,
            "recent_uploads": doc_count,  # AI Search에 인덱싱된 모든 문서
            "status": "✅ Active",
            "index_name": index_name
        }
    except Exception as e:
        print(f"❌ Stats error: {e}")
        return {
            "total_documents": 0,
            "recent_uploads": 0,
            "status": "⚠️ Error",
            "index_name": index_name
        }

@router.get("/documents")
async def list_documents():
    """AI Search 인덱스에 저장된 모든 문서 목록 조회 - 실제 content 포함"""
    try:
        from app.services.search_service import get_search_client
        
        search_client = get_search_client()
        results = search_client.search(search_text="*", include_total_count=True, top=100)
        
        docs = []
        for result in results:
            docs.append({
                "id": result.get("id", ""),
                "file_name": result.get("file_name", "Unknown"),
                "content": result.get("content", ""),  # 실제 content 포함!
                "content_length": len(result.get("content", ""))
            })
        
        print(f"📋 API 응답: {len(docs)}개 문서 (실제 content 포함)")
        
        return {
            "count": len(docs),
            "documents": docs
        }
    except Exception as e:
        print(f"❌ Documents list error: {e}")
        traceback.print_exc()
        return {
            "count": 0,
            "documents": []
        }

@router.get("/indexes")
async def list_indexes():
    """사용 가능한 모든 RAG 인덱스 목록 조회"""
    try:
        from app.services.search_service import get_search_index_client
        
        index_client = get_search_index_client()
        indexes = index_client.list_indexes()
        
        index_list = []
        for index in indexes:
            index_list.append({
                "name": index.name,
                "fields_count": len(index.fields) if index.fields else 0
            })
        
        print(f"📋 사용 가능한 인덱스: {len(index_list)}개")
        for idx in index_list:
            print(f"   - {idx['name']}")
        
        return {
            "count": len(index_list),
            "indexes": index_list
        }
    except Exception as e:
        print(f"❌ Index list error: {e}")
        traceback.print_exc()
        return {
            "count": 0,
            "indexes": []
        }
