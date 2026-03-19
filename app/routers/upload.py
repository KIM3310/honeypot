from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form, Depends, Request
from fastapi.responses import JSONResponse
from app.security import get_current_user, verify_and_rotate_csrf_from_request, enforce_api_rate_limit
from app.config import APP_MODE, is_demo_mode
from app.services.blob_service import upload_to_blob, save_processed_json
from app.services.document_service import extract_text_from_url, extract_text_from_docx
from app.services.search_service import get_document_count
import uuid
import traceback
from typing import Optional
import os
import re
from app.state import task_manager
from app.services.openai_service import analyze_text_for_search
from app.services.search_service import index_processed_chunks
from app.services.llm_override import LLMOverrideConfig, parse_llm_override_from_request, summarize_override_for_log
import json

router = APIRouter()

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
MAX_FILENAME_LENGTH = 255
INDEX_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{1,62}$")
ALLOWED_UPLOAD_EXTENSIONS = {
    "txt",
    "text",
    "md",
    "pdf",
    "docx",
    "py",
    "js",
    "java",
    "c",
    "cpp",
    "h",
    "cs",
    "ts",
    "tsx",
    "html",
    "css",
    "json",
}
DEMO_LLM_PREPROCESS_ENABLED = os.getenv("DEMO_LLM_PREPROCESS", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def normalize_index_name(index_name: Optional[str]) -> Optional[str]:
    raw = (index_name or "").strip()
    if not raw:
        return None
    normalized = raw.lower()
    if not INDEX_NAME_PATTERN.match(normalized):
        raise HTTPException(
            status_code=400,
            detail="index_name 형식이 유효하지 않습니다. (영문 소문자/숫자/`-`/`_`, 2~63자)",
        )
    return normalized


def validate_upload_input(file_name: str, file_data: bytes, file_ext: str) -> None:
    if not file_name:
        raise HTTPException(status_code=400, detail="파일명이 비어 있습니다.")
    if len(file_name) > MAX_FILENAME_LENGTH:
        raise HTTPException(status_code=400, detail=f"파일명 길이는 {MAX_FILENAME_LENGTH}자를 초과할 수 없습니다.")

    if len(file_data) <= 0:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")
    if len(file_data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"파일 크기 제한({MAX_UPLOAD_BYTES // (1024 * 1024)}MB)을 초과했습니다.",
        )

    if file_ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"지원하지 않는 파일 형식입니다: .{file_ext or 'unknown'}",
        )

# --- Async File Processing Pipeline ---

#창훈 코드 추가

async def process_file_background(
    task_id: str,
    file_name: str,
    file_data: bytes,
    file_ext: str,
    index_name: str = None,
    llm_override: Optional[LLMOverrideConfig] = None,
):
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

        # Demo-mode: local extraction -> local/demo chunking -> in-memory index (no cloud creds needed).
        if is_demo_mode():
            from app.services.demo_pipeline import build_demo_chunks
            from app.services import demo_store

            task_manager.update_task(task_id, progress=20, message=f"[Demo mode] Extracting text: {file_name}")

            extracted_text = ""
            if file_ext in ['txt', 'py', 'js', 'java', 'c', 'cpp', 'h', 'cs', 'ts', 'tsx', 'html', 'css', 'json', 'md']:
                try:
                    extracted_text = file_data.decode('utf-8')
                except UnicodeDecodeError:
                    extracted_text = file_data.decode('cp949', errors='ignore')
            elif file_ext == 'docx':
                try:
                    extracted_text = extract_text_from_docx(file_data)
                except Exception as e:
                    task_manager.update_task(task_id, status="failed", message=f"[Demo mode] DOCX extraction failed: {str(e)}")
                    return
            else:
                task_manager.update_task(
                    task_id,
                    status="failed",
                    message=f"[Demo mode] Unsupported file type: .{file_ext or 'unknown'}. "
                    f"Demo mode supports txt/md/code/docx. Use live mode for PDF/images.",
                )
                return

            if not extracted_text.strip():
                task_manager.update_task(task_id, status="failed", message="[Demo mode] No text extracted from file.")
                return

            file_type = "code" if file_ext in ['py', 'js', 'java', 'cpp', 'ts', 'tsx', 'cs'] else "doc"
            # Keep demo uploads deterministic/fast by default.
            # User LLM preprocess can be enabled explicitly via DEMO_LLM_PREPROCESS=true.
            if llm_override and DEMO_LLM_PREPROCESS_ENABLED:
                task_manager.update_task(task_id, progress=60, message="[Demo mode] Preprocessing with user LLM...")
                chunks = analyze_text_for_search(
                    extracted_text,
                    file_name,
                    file_type=file_type,
                    llm_override=llm_override,
                )
            else:
                task_manager.update_task(task_id, progress=60, message="[Demo mode] Preprocessing (deterministic chunking)...")
                chunks = build_demo_chunks(extracted_text, file_name, file_type=file_type)
            if not chunks:
                task_manager.update_task(task_id, status="failed", message="[Demo mode] Preprocessing failed (no chunks).")
                return

            task_manager.update_task(task_id, progress=85, message="[Demo mode] Indexing locally...")
            indexed_count = demo_store.add_chunks(index_name, chunks)
            task_manager.update_task(
                task_id,
                status="completed",
                progress=100,
                message=f"[Demo mode] Upload complete. Indexed {indexed_count} chunks to '{demo_store.normalize_index_name(index_name)}'.",
            )
            return
        
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
        chunks = analyze_text_for_search(
            extracted_text,
            file_name,
            file_type=file_type,
            llm_override=llm_override,
        )
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
    new_csrf_token = verify_and_rotate_csrf_from_request(request, user["email"])
    enforce_api_rate_limit(
        request,
        bucket="upload-post",
        limit=20,
        window_seconds=60,
        user_email=user.get("email"),
    )
    """
    파일 업로드 엔드포인트 (비동기 처리)
    파일을 받자마자 task_id를 리턴하고, 백그라운드에서 처리 시작.

    Args:
        file: 업로드할 파일
        index_name: RAG 인덱스 이름 (선택 사항, 지정하지 않으면 기본 인덱스)
    """
    try:
        normalized_index_name = normalize_index_name(index_name)
        llm_override = parse_llm_override_from_request(request)
        # 1. 파일 데이터 읽기 (메모리)
        file_data = await file.read()
        file_name = file.filename
        file_ext = file_name.lower().split('.')[-1] if '.' in file_name else ''
        validate_upload_input(file_name, file_data, file_ext)

        # 2. Task 생성
        task_id = str(uuid.uuid4())
        task_manager.create_task(task_id, owner_email=user.get("email", ""))

        # 3. 백그라운드 작업 등록
        print(
            f"📋 Upload request: file={file_name}, index={normalized_index_name or 'default'}, "
            f"llm={summarize_override_for_log(llm_override)}"
        )
        background_tasks.add_task(
            process_file_background,
            task_id,
            file_name,
            file_data,
            file_ext,
            normalized_index_name,
            llm_override,
        )

        return JSONResponse(
            content={
                "message": "Upload started",
                "task_id": task_id,
                "file_name": file_name,
                "index_name": normalized_index_name or "default",
            },
            headers={"X-CSRF-Token": new_csrf_token},
        )

    except HTTPException as exc:
        headers = dict(exc.headers or {})
        headers["X-CSRF-Token"] = new_csrf_token
        raise HTTPException(status_code=exc.status_code, detail=exc.detail, headers=headers)
        
    except Exception as e:
        print(f"❌ Upload request failed: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="파일 업로드 요청 처리 중 오류가 발생했습니다.",
            headers={"X-CSRF-Token": new_csrf_token},
        )


@router.get("/status/{task_id}")
async def get_task_status(request: Request, task_id: str, user: dict = Depends(get_current_user)):
    """백그라운드 작업 상태 조회"""
    enforce_api_rate_limit(
        request,
        bucket="upload-status",
        limit=300,
        window_seconds=60,
        user_email=user.get("email"),
    )
    task = task_manager.get_task(task_id, include_private=True)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    email = user.get("email")
    role = user.get("role")
    if role != "admin" and task.get("owner_email") != email:
        raise HTTPException(status_code=403, detail="해당 작업에 접근할 권한이 없습니다.")

    safe_task = dict(task)
    safe_task.pop("owner_email", None)
    return safe_task



@router.get("/stats")
async def get_stats(request: Request, index_name: str = "documents-index", _user: dict = Depends(get_current_user)):
    """시스템 통계 조회 - 최근 업로드 갯수, 인덱스 문서 갯수"""
    try:
        enforce_api_rate_limit(
            request,
            bucket="upload-stats",
            limit=120,
            window_seconds=60,
            user_email=_user.get("email"),
        )
        index_name = normalize_index_name(index_name) or "documents-index"
        doc_count = get_document_count(index_name)
        print(f"📊 시스템 통계: {doc_count}개 문서 인덱싱됨")
        
        return {
            "total_documents": doc_count,
            "recent_uploads": doc_count,  # AI Search에 인덱싱된 모든 문서
            "status": "🧪 Demo" if APP_MODE == "demo" else "✅ Active",
            "index_name": index_name,
            "mode": APP_MODE,
        }
    except Exception as e:
        print(f"❌ Stats error: {e}")
        return {
            "total_documents": 0,
            "recent_uploads": 0,
            "status": "⚠️ Error",
            "index_name": index_name,
            "mode": APP_MODE,
        }

@router.get("/documents")
async def list_documents(request: Request, index_name: str = "documents-index", _user: dict = Depends(get_current_user)):
    """AI Search 인덱스에 저장된 모든 문서 목록 조회 - 실제 content 포함"""
    try:
        enforce_api_rate_limit(
            request,
            bucket="upload-documents",
            limit=120,
            window_seconds=60,
            user_email=_user.get("email"),
        )
        index_name = normalize_index_name(index_name) or "documents-index"
        if is_demo_mode():
            from app.services import demo_store

            docs = demo_store.get_all_documents(index_name)
            out = []
            for d in docs:
                file_name = d.get("fileName") or d.get("file_name") or "Unknown"
                content = str(d.get("content") or "")
                out.append(
                    {
                        "id": d.get("id") or "",
                        "file_name": file_name,
                        "content": content,
                        "content_length": len(content),
                    }
                )

            return {"count": len(out), "documents": out}

        from app.services.search_service import get_search_client
        
        search_client = get_search_client(index_name=index_name)
        results = search_client.search(search_text="*", include_total_count=True, top=100)
        
        docs = []
        for result in results:
            file_name = result.get("fileName") or result.get("file_name") or "Unknown"
            docs.append({
                "id": result.get("id", ""),
                # Frontend expects snake_case.
                "file_name": file_name,
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
async def list_indexes(request: Request, _user: dict = Depends(get_current_user)):
    """사용 가능한 모든 RAG 인덱스 목록 조회"""
    try:
        enforce_api_rate_limit(
            request,
            bucket="upload-indexes",
            limit=120,
            window_seconds=60,
            user_email=_user.get("email"),
        )
        if is_demo_mode():
            from app.services import demo_store

            indexes = demo_store.list_indexes()
            return {"count": len(indexes), "indexes": indexes}

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
