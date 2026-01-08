# app/routers/chat.py

from fastapi import APIRouter, HTTPException, Depends, Request  # ← Request 추가!
from pydantic import BaseModel
from app.services.search_service import search_documents
from app.services.openai_service import chat_with_context, analyze_files_for_handover
from app.auth import get_current_user  # ← 추가 (한 줄)
import json
import traceback
from app.routers.auth import verify_csrf_token, verify_token

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list

class AnalyzeRequest(BaseModel):
    messages: list

# ===== 변경 1: analyze 함수 =====
@router.post("/analyze")
async def analyze(
    request: Request,  # ← AnalyzeRequest → Request로 변경
    analyze_request: AnalyzeRequest,  # ← 새로 추가
    user: dict = Depends(get_current_user)
):
    # ===== CSRF 검증 추가 =====
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        raise HTTPException(
            status_code=403,
            detail="CSRF Token이 필요합니다."
        )
    verify_csrf_token(csrf_token, user['email'])
    """
    인수인계서 분석 (로그인 필수)
    """
    try:
        # 사용자 정보 로깅 (감사 추적)
        print(f"🔍 [{user['name']}] /analyze 요청 - messages: {len(analyze_request.messages)}")

        # 프론트엔드에서 보낸 메시지 형식 처리
        messages = analyze_request.messages  # ← analyze_request 사용!

        # 사용자 메시지에서 파일 내용 추출
        user_message = next((m["content"] for m in messages if m["role"] == "user"), "")

        print(f"📄 추출된 사용자 메시지 길이: {len(user_message)}")

        if len(user_message) == 0:
            print("⚠️ 빈 메시지 - 샘플 데이터로 응답")

        # OpenAI API를 호출하여 인수인계서 JSON 생성
        print("🤖 OpenAI API 호출 시작...")
        response = analyze_files_for_handover(user_message)

        print(f"✅ OpenAI 응답 완료 - 타입: {type(response)}")
        print(f"응답 샘플: {str(response)[:200]}")

        # 응답 검증
        if not isinstance(response, dict):
            print(f"⚠️ 응답이 dict가 아님: {type(response)} - 타입 변환 시도")
            if isinstance(response, str):
                try:
                    response = json.loads(response)
                except:
                    response = {"overview": {}, "jobStatus": {}}

        # 필수 필드 확인
        if "overview" not in response:
            print("⚠️ overview 필드 없음 - 기본값 추가")
            response["overview"] = {"transferor": {}, "transferee": {}}

        print(f"📤 최종 응답 필드: {list(response.keys())}")
        print(f"📊 최종 응답 크기: {len(str(response))} 글자")

        # 응답에 사용자 정보 포함
        return {
            "content": response,
            "user_info": {
                "name": user['name'],
                "email": user['email'],
                "role": user['role']
            }
        }

    except Exception as e:
        print(f"❌ Analyze error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ===== 변경 2: chat 함수 =====
@router.post("/chat")
async def chat(
    request: Request,  # ← ChatRequest → Request로 변경
    chat_request: ChatRequest,  # ← 새로 추가: 실제 요청 데이터
    user: dict = Depends(get_current_user)
):
    # ===== CSRF 검증 (새로 추가) =====
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        raise HTTPException(
            status_code=403,
            detail="CSRF Token이 필요합니다."
        )
    verify_csrf_token(csrf_token, user['email'])  # ← CSRF 검증!
    """
    채팅 (로그인 필수)
    """
    try:
        # messages 배열에서 사용자 메시지 추출
        messages = chat_request.messages  # ← chat_request 사용!
        user_message = next((m["content"] for m in messages if m["role"] == "user"), "")

        if not user_message:
            return {
                "content": "메시지를 입력해주세요.",
                "response": "메시지를 입력해주세요."
            }

        # 사용자 정보 로깅 (감사 추적)
        print(f"💬 [{user['name']}] /chat 요청 - 메시지: {user_message[:100]}")

        # 1. 관련 문서 검색
        search_results = search_documents(user_message)

        if not search_results:
            return {
                "content": "관련 문서를 찾을 수 없습니다. 먼저 문서를 업로드해주세요.",
                "response": "관련 문서를 찾을 수 없습니다. 먼저 문서를 업로드해주세요."
            }

        # 2. 컨텍스트 생성
        context = "\n\n".join([
            f"[{doc['file_name']}]\n{doc['content']}"
            for doc in search_results
        ])

        # 3. GPT로 답변 생성
        response = chat_with_context(user_message, context)

        print(f"✅ [{user['name']}] 채팅 응답 완료 - {len(response)} 글자")

        # 응답에 사용자 정보 포함
        return {
            "content": response,
            "response": response,
            "sources": [doc["file_name"] for doc in search_results],
            "user_info": {
                "name": user['name'],
                "email": user['email'],
                "role": user['role']
            }
        }

    except Exception as e:
        print(f"❌ Chat error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
