# app/routers/chat.py

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.services.search_service import search_documents
from app.services.openai_service import chat_with_context, analyze_files_for_handover
from app.services.llm_override import parse_llm_override_from_request, summarize_override_for_log
from app.security import get_current_user, verify_and_rotate_csrf_from_request, enforce_api_rate_limit
import json
import re
import traceback

router = APIRouter()
MAX_MESSAGES = 40
MAX_MESSAGE_CHARS = 12000
INDEX_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{1,62}$")

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list
    index_name: str = None  # RAG 인덱스 선택 (optional)

class AnalyzeRequest(BaseModel):
    messages: list
    index_name: str = None


def _normalize_index_name(index_name: Optional[str]) -> Optional[str]:
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


def _validate_messages(messages: list) -> None:
    if not isinstance(messages, list) or len(messages) == 0:
        raise HTTPException(status_code=400, detail="messages는 비어있지 않은 배열이어야 합니다.")
    if len(messages) > MAX_MESSAGES:
        raise HTTPException(status_code=400, detail=f"messages는 최대 {MAX_MESSAGES}개까지 허용됩니다.")

    allowed_roles = {"system", "user", "assistant"}
    for idx, item in enumerate(messages):
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"messages[{idx}] 형식이 올바르지 않습니다.")
        role = str(item.get("role", "")).strip()
        content = str(item.get("content", ""))
        if role not in allowed_roles:
            raise HTTPException(status_code=400, detail=f"messages[{idx}].role 값이 유효하지 않습니다.")
        if not content.strip():
            raise HTTPException(status_code=400, detail=f"messages[{idx}].content는 비어 있을 수 없습니다.")
        if len(content) > MAX_MESSAGE_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"messages[{idx}].content 길이는 최대 {MAX_MESSAGE_CHARS}자입니다.",
            )

# ===== 변경 1: analyze 함수 =====
@router.post("/analyze")
async def analyze(
    request: Request,  # ← AnalyzeRequest → Request로 변경
    analyze_request: AnalyzeRequest,  # ← 새로 추가
    user: dict = Depends(get_current_user)
):
    new_csrf_token = verify_and_rotate_csrf_from_request(request, user["email"])
    enforce_api_rate_limit(
        request,
        bucket="analyze-post",
        limit=30,
        window_seconds=60,
        user_email=user.get("email"),
    )
    """
    인수인계서 분석 (로그인 필수)
    """
    try:
        # 사용자 정보 로깅 (감사 추적)
        print(f"🔍 [{user['name']}] /analyze 요청 - messages: {len(analyze_request.messages)}")
        llm_override = parse_llm_override_from_request(request)

        # 프론트엔드에서 보낸 메시지 형식 처리
        messages = analyze_request.messages  # ← analyze_request 사용!
        _validate_messages(messages)
        normalized_index_name = _normalize_index_name(analyze_request.index_name)

        # 사용자 메시지에서 파일 내용 추출
        user_message = next((m["content"] for m in messages if m["role"] == "user"), "")

        print(f"📄 추출된 사용자 메시지 길이: {len(user_message)}")

        if len(user_message) == 0:
            print("⚠️ 빈 메시지 - 샘플 데이터로 응답")

        # OpenAI API를 호출하여 인수인계서 JSON 생성
        print(f"🤖 LLM 호출 시작... provider={summarize_override_for_log(llm_override)}")
        response = analyze_files_for_handover(
            user_message,
            index_name=normalized_index_name,
            llm_override=llm_override,
        )

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
        return JSONResponse(
            content={
                "content": response,
                "user_info": {
                    "name": user["name"],
                    "email": user["email"],
                    "role": user["role"],
                },
            },
            headers={"X-CSRF-Token": new_csrf_token},
        )

    except HTTPException as exc:
        headers = dict(exc.headers or {})
        headers["X-CSRF-Token"] = new_csrf_token
        raise HTTPException(status_code=exc.status_code, detail=exc.detail, headers=headers)

    except Exception as e:
        print(f"❌ Analyze error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="인수인계서 분석 처리 중 오류가 발생했습니다.",
            headers={"X-CSRF-Token": new_csrf_token},
        )

# ===== 변경 2: chat 함수 =====
@router.post("/chat")
async def chat(
    request: Request,  # ← ChatRequest → Request로 변경
    chat_request: ChatRequest,  # ← 새로 추가: 실제 요청 데이터
    user: dict = Depends(get_current_user)
):
    new_csrf_token = verify_and_rotate_csrf_from_request(request, user["email"])
    enforce_api_rate_limit(
        request,
        bucket="chat-post",
        limit=60,
        window_seconds=60,
        user_email=user.get("email"),
    )
    """
    채팅 (로그인 필수)
    """
    try:
        llm_override = parse_llm_override_from_request(request)
        # messages 배열에서 사용자 메시지 추출
        messages = chat_request.messages  # ← chat_request 사용!
        _validate_messages(messages)
        normalized_index_name = _normalize_index_name(chat_request.index_name)
        user_message = next((m["content"] for m in messages if m["role"] == "user"), "")

        if not user_message:
            return JSONResponse(
                content={
                    "content": "메시지를 입력해주세요.",
                    "response": "메시지를 입력해주세요.",
                },
                headers={"X-CSRF-Token": new_csrf_token},
            )

        # 사용자 정보 로깅 (감사 추적)
        print(f"💬 [{user['name']}] /chat 요청 - 메시지: {user_message[:100]}, 인덱스: {normalized_index_name or 'default'}")

        # 1. 관련 문서 검색 (선택된 인덱스에서)
        search_results = search_documents(user_message, index_name=normalized_index_name)

        if not search_results:
            return JSONResponse(
                content={
                    "content": "관련 문서를 찾을 수 없습니다. 먼저 문서를 업로드해주세요.",
                    "response": "관련 문서를 찾을 수 없습니다. 먼저 문서를 업로드해주세요.",
                },
                headers={"X-CSRF-Token": new_csrf_token},
            )

        # 2. 컨텍스트 생성
        context = "\n\n".join([
            f"[{doc['file_name']}]\n{doc['content']}"
            for doc in search_results
        ])

        # 3. GPT로 답변 생성
        response = chat_with_context(user_message, context, llm_override=llm_override)

        print(f"✅ [{user['name']}] 채팅 응답 완료 - {len(response)} 글자")

        # 응답에 사용자 정보 포함
        return JSONResponse(
            content={
                "content": response,
                "response": response,
                "sources": [doc["file_name"] for doc in search_results],
                "user_info": {
                    "name": user["name"],
                    "email": user["email"],
                    "role": user["role"],
                },
            },
            headers={"X-CSRF-Token": new_csrf_token},
        )

    except HTTPException as exc:
        headers = dict(exc.headers or {})
        headers["X-CSRF-Token"] = new_csrf_token
        raise HTTPException(status_code=exc.status_code, detail=exc.detail, headers=headers)

    except Exception as e:
        print(f"❌ Chat error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="채팅 처리 중 오류가 발생했습니다.",
            headers={"X-CSRF-Token": new_csrf_token},
        )
