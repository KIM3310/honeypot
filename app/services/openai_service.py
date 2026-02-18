from openai import AzureOpenAI, OpenAI
from app.config import (
    AZURE_OPENAI_ENDPOINT, 
    AZURE_OPENAI_API_KEY, 
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_CHAT_DEPLOYMENT,
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    GOOGLE_API_KEY,
    GEMINI_MODEL,
    is_demo_mode,
)
from app.services.prompts import DOC_PROMPT, CODE_PROMPT
from app.services.llm_override import LLMOverrideConfig, summarize_override_for_log
import json
import traceback
import uuid
from typing import Optional

def get_openai_client():
    if is_demo_mode():
        raise RuntimeError("Azure OpenAI client is not available in demo mode.")
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_API_KEY:
        raise RuntimeError(
            "Azure OpenAI is not configured. "
            "Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in proto.env (or switch to APP_MODE=demo)."
        )
    return AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
        azure_endpoint=AZURE_OPENAI_ENDPOINT
    )

def get_google_client():
    """Google Gemini 클라이언트 (채팅/분석용)"""
    if is_demo_mode():
        raise RuntimeError("Gemini client is not available in demo mode.")
    if not GOOGLE_API_KEY:
        raise RuntimeError(
            "Gemini is not configured. Set GOOGLE_API_KEY in proto.env (or switch to APP_MODE=demo)."
        )
    return OpenAI(
        api_key=GOOGLE_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )


def _get_user_llm_client(llm_override: LLMOverrideConfig) -> OpenAI:
    kwargs = {"api_key": llm_override.api_key}
    if llm_override.base_url:
        kwargs["base_url"] = llm_override.base_url
    return OpenAI(**kwargs)


def _create_chat_completion_with_json_fallback(
    *,
    client,
    model: str,
    messages: list,
    temperature: float,
    max_tokens: int,
    timeout: Optional[int] = None,
):
    options = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    if timeout is not None:
        options["timeout"] = timeout

    try:
        return client.chat.completions.create(**options)
    except Exception as exc:
        # Some OpenAI-compatible providers do not support response_format=json_object.
        if "response_format" not in str(exc):
            raise

    options.pop("response_format", None)
    return client.chat.completions.create(**options)

def get_embedding(text: str) -> list:
    if is_demo_mode():
        raise RuntimeError("Embeddings are not available in demo mode.")
    client = get_openai_client()
    response = client.embeddings.create(
        input=text,
        model=AZURE_OPENAI_EMBEDDING_DEPLOYMENT
    )
    return response.data[0].embedding

def analyze_text_for_search(
    text: str,
    file_name: str,
    file_type: str = "doc",
    llm_override: Optional[LLMOverrideConfig] = None,
) -> list:
    """
    [복구됨] 추출된 텍스트를 LLM(Gemini)에 보내 구조화된 JSON(청크 리스트)으로 변환합니다.
    file_type: 'code' 또는 'doc' (그 외는 doc으로 처리)
    """
    if is_demo_mode() and not llm_override:
        # Demo-grade preprocessing: no external LLM calls.
        from app.services.demo_pipeline import build_demo_chunks

        return build_demo_chunks(text, file_name, file_type=file_type)

    if llm_override:
        client = _get_user_llm_client(llm_override)
        model = llm_override.model
        provider_label = f"user LLM ({summarize_override_for_log(llm_override)})"
    else:
        client = get_google_client()
        model = GEMINI_MODEL
        provider_label = "Gemini"
    
    # 1. 파일 유형에 따른 프롬프트 선택
    if file_type == "code":
        system_prompt = CODE_PROMPT
    else:
        system_prompt = DOC_PROMPT
        
    user_message = f"""
    [Input Document Info]
    FileName: {file_name}
    FileType: {file_type}
    
    [Input Text]
    {text[:50000]} 
    
    (Note: If text is truncated, process only what is provided. Do not hallucinate.)
    """
    # 50000자 제한: Gemini Context Window는 크지만 안전하게 제한

    try:
        print(
            f"🧠 Processing with {provider_label} ({file_type})... Input length: {len(text[:50000])}",
            flush=True,
        )
        
        response = _create_chat_completion_with_json_fallback(
            client=client,
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1, # 정형 데이터 추출이므로 낮게 설정
            max_tokens=16000,
            timeout=120,
        )
        
        print("✅ LLM response received.", flush=True)
        response_text = response.choices[0].message.content

        print("\n=== [LLM Response Output] ===")
        print(response_text)
        print("================================\n")
        
        # JSON 파싱
        try:
            parsed = json.loads(response_text)
            
            if isinstance(parsed, list):
                chunks = parsed
            elif isinstance(parsed, dict):
                # 최상위 키가 하나고 그 값이 리스트라면 그것을 사용
                # ex: {"chunks": [...]} or {"data": [...]}
                found_list = False
                for key, value in parsed.items():
                    if isinstance(value, list):
                        chunks = value
                        found_list = True
                        break
                if not found_list:
                    # 그냥 딕셔너리 하나라면 리스트로 감쌈
                    chunks = [parsed]
            else:
                chunks = []
                
            # 필수 필드 보정
            print(f"Generated {len(chunks)} chunks.")
            for chunk in chunks:
                if not chunk.get("id"):
                    chunk["id"] = f"{uuid.uuid4()}"
                if not chunk.get("fileName"):
                    chunk["fileName"] = file_name
                if not chunk.get("chunkMeta"):
                    chunk["chunkMeta"] = {}
                
            return chunks
            
        except json.JSONDecodeError:
            print(f"❌ LLM response is not valid JSON: {response_text[:100]}...")
            return []
            
    except Exception as e:
        print(f"❌ LLM Chat Completion failed: {e}")
        traceback.print_exc()
        return []
    
def _needs_index_enrichment(file_context: str) -> bool:
    s = (file_context or "").strip()
    if len(s) < 80:
        return True
    markers = [
        "Task ID",
        "백그라운드 처리",
        "업로드 완료",
        "Upload started",
        "업로드 중 오류",
    ]
    return any(m in s for m in markers)


def analyze_files_for_handover(
    file_context: str,
    *,
    index_name: str = None,
    llm_override: Optional[LLMOverrideConfig] = None,
) -> dict:
    """파일 내용을 분석하여 인수인계서 JSON 생성 - 프론트엔드 HandoverData 형식으로 반환"""
    if is_demo_mode() and not llm_override:
        from app.services import demo_store
        from app.services.demo_pipeline import generate_demo_handover

        if _needs_index_enrichment(file_context):
            docs = demo_store.get_all_documents(index_name)
            doc_contents = []
            for d in docs[:10]:
                fn = d.get("fileName") or d.get("file_name") or "Unknown"
                content = str(d.get("content") or "")
                if content:
                    doc_contents.append(f"[파일: {fn}]\n{content[:1000]}\n")
            if doc_contents:
                indexed_context = "\n".join(doc_contents)
                file_context = indexed_context if not file_context else file_context + "\n\n---\n\n" + indexed_context

        return generate_demo_handover(file_context or "")

    # 문서 컨텍스트 보강 (placeholder/empty context일 때)
    if _needs_index_enrichment(file_context):
        if is_demo_mode():
            from app.services import demo_store

            docs = demo_store.get_all_documents(index_name)
            doc_contents = []
            for d in docs[:10]:
                fn = d.get("fileName") or d.get("file_name") or "Unknown"
                content = str(d.get("content") or "")
                if content:
                    doc_contents.append(f"[파일: {fn}]\n{content[:1000]}\n")
            if doc_contents:
                indexed_context = "\n".join(doc_contents)
                file_context = indexed_context if not file_context else file_context + "\n\n---\n\n" + indexed_context
        else:
            from app.services.search_service import get_search_client

            print("📄 Azure Search에서 모든 문서 검색 중...")
            try:
                search_client = get_search_client(index_name=index_name)
                results = search_client.search(search_text="*", include_total_count=True, top=10)

                doc_contents = []
                for result in results:
                    file_name = result.get("fileName") or result.get("file_name") or "Unknown"
                    content = result.get("content", "")
                    if content and len(content) > 0:
                        # 최대 1000자까지만 포함
                        content_preview = content[:1000]
                        doc_contents.append(f"[파일: {file_name}]\n{content_preview}\n")
                        print(f"✅ 문서 포함됨: {file_name} ({len(content)} 글자)")

                if doc_contents:
                    print(f"📋 {len(doc_contents)}개 문서 검색됨")
                    indexed_context = "\n".join(doc_contents)
                    file_context = indexed_context if not file_context else file_context + "\n\n---\n\n" + indexed_context
                else:
                    print("⚠️  검색 결과가 비어있음")
            except Exception as e:
                print(f"⚠️  문서 검색 실패: {e}")
                traceback.print_exc()
    
    # 파일이 없거나 매우 짧으면 샘플 데이터 추가
    if not file_context or len(file_context.strip()) < 20:
        print("ℹ️  파일 컨텍스트가 부족함 - 샘플 데이터 추가")
        file_context += """

[샘플: 프로젝트 현황 보고]
프로젝트명: 시스템 고도화
담당자: 김철수 과장 (kim.cs@company.com)
인수자: 이영희 대리 (lee.yh@company.com)
인수 예정일: 2025-02-15
개발현황: 70% 진행 중 (메인 기능 개발 완료, 최적화 진행 중)
주요 담당 업무: 백엔드 API 개발, 데이터베이스 설계, 보안 구현
팀원: 박준호(프론트엔드), 최민수(QA)
위험요소: 일정 지연 가능성 (2주)
다음 마일스톤: 2025-02-01 알파 테스트"""
    
    print(f"📊 최종 컨텍스트 길이: {len(file_context)} 글자")

    system_message = """
당신은 인수인계서 생성 전문가입니다. 반드시 유효한 JSON 형식으로만 답변하세요.

아래 자료는 AI Search 인덱스에서 추출된 업무 문서의 요약 또는 원문입니다. 자료가 많을 경우 중복되거나 불필요한 내용은 통합·요약하고, 실제 인수인계서처럼 구체적이고 실무적으로 작성하세요.

자료에 포함된 정보는 최대한 반영하고, 자료가 부족하거나 없는 항목은 빈 배열([]) 또는 빈 문자열("")로 채워주세요. 자료가 너무 많으면 핵심 내용 위주로 요약해도 됩니다.

응답 형식 (프론트엔드 요구사항에 맞춤):
{
    "overview": {
        "transferor": {"name": "인계자명", "position": "직급/부서", "contact": "연락처"},
        "transferee": {"name": "인수자명", "position": "직급/부서", "contact": "연락처", "startDate": "시작일"},
        "reason": "인수인계 사유",
        "background": "업무 배경",
        "period": "근무 기간",
        "schedule": [{"date": "날짜", "activity": "활동"}]
    },
    "jobStatus": {
        "title": "직책",
        "responsibilities": ["책임내용1", "책임내용2"],
        "authority": "권한",
        "reportingLine": "보고체계",
        "teamMission": "팀 미션",
        "teamGoals": ["목표1", "목표2"]
    },
    "priorities": [
        {"rank": 1, "title": "우선과제명", "status": "상태", "solution": "해결방안", "deadline": "마감일"}
    ],
    "stakeholders": {
        "manager": "상급자",
        "internal": [{"name": "이름", "role": "역할"}],
        "external": [{"name": "이름", "role": "역할"}]
    },
    "teamMembers": [
        {"name": "팀원명", "position": "직급", "role": "역할", "notes": "비고"}
    ],
    "ongoingProjects": [
        {"name": "프로젝트명", "owner": "담당자", "status": "상태", "progress": 50, "deadline": "마감일", "description": "설명"}
    ],
    "risks": {"issues": "현안", "risks": "위험요소"},
    "roadmap": {"shortTerm": "단기계획", "longTerm": "장기계획"},
    "resources": {
        "docs": [{"category": "분류", "name": "문서명", "location": "위치"}],
        "systems": [{"name": "시스템명", "usage": "사용방법", "contact": "담당자"}],
        "contacts": [{"category": "분류", "name": "이름", "position": "직급", "contact": "연락처"}]
    },
    "checklist": [{"text": "확인항목", "completed": false}]
}
"""

    user_message = f"""
아래는 AI Search 인덱스에서 추출된 업무 자료(요약/원문)입니다. 이 자료들을 분석하여 실제 업무 인수인계서처럼 구체적이고 실무적으로 JSON을 작성해 주세요.

자료가 많으면 중복/불필요한 내용은 통합·요약하고, 자료에 있는 정보는 최대한 반영하세요. 없는 항목은 빈 배열([]) 또는 빈 문자열("")로 남겨두세요.

자료:
{file_context}

위의 JSON 형식을 반드시 따르세요.
"""

    if llm_override:
        client = _get_user_llm_client(llm_override)
        model = llm_override.model
        provider_label = summarize_override_for_log(llm_override)
    else:
        client = get_openai_client()
        model = AZURE_OPENAI_CHAT_DEPLOYMENT
        provider_label = "azure-default"

    try:
        print(f"🚀 LLM 호출 시작... provider={provider_label}")
        print(f"   - 컨텍스트 길이: {len(file_context)}")

        response = _create_chat_completion_with_json_fallback(
            client=client,
            model=model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=4000,
        )

        print(f"✅ OpenAI 응답 수신")
        response_text = response.choices[0].message.content
        print(f"   응답 길이: {len(response_text)} 글자")

        # JSON 파싱 시도
        try:
            print(f"🔍 JSON 파싱 시도...")
            result = json.loads(response_text)
            print(f"✅ JSON 파싱 성공 - 키: {list(result.keys())}")
            return result
        except json.JSONDecodeError as e:
            print(f"⚠️  JSON 파싱 실패: {e}")
            # JSON 파싱 실패 시 기본 구조 반환
            return {
                "overview": {
                    "transferor": {"name": "", "position": "", "contact": ""},
                    "transferee": {"name": "", "position": "", "contact": ""}
                },
                "jobStatus": {"title": "", "responsibilities": []},
                "priorities": [],
                "stakeholders": {"manager": "", "internal": [], "external": []},
                "teamMembers": [],
                "ongoingProjects": [],
                "risks": {"issues": "", "risks": ""},
                "roadmap": {"shortTerm": "", "longTerm": ""},
                "resources": {"docs": [], "systems": [], "contacts": []},
                "checklist": [],
                "rawContent": response_text
            }
    except Exception as e:
        print(f"❌ LLM 호출 실패: {e}")
        traceback.print_exc()
        # system_message 등 로컬 변수 참조 없이 에러만 반환
        raise Exception(f"API 에러: {e}")

def chat_with_context(
    query: str,
    context: str,
    llm_override: Optional[LLMOverrideConfig] = None,
) -> str:
    if is_demo_mode() and not llm_override:
        from app.services.demo_pipeline import generate_demo_chat_answer

        return generate_demo_chat_answer(query, context)

    if llm_override:
        client = _get_user_llm_client(llm_override)
        model = llm_override.model
    else:
        client = get_openai_client()
        model = AZURE_OPENAI_CHAT_DEPLOYMENT
    
    system_message = """당신은 업무 인수인계/문서 Q&A 어시스턴트입니다.

규칙:
1) 아래 '참고 문서'에서 근거를 찾고, 근거가 있는 내용만 단정적으로 말하세요.
2) 문서에 없는 내용은 추측하지 말고, "문서에서 확인되지 않습니다"라고 명시하세요.
3) 답변은 간결하게, 필요하면 항목(불릿)으로 정리하세요.
4) 문서의 파일명/섹션을 근거로 함께 제시하세요."""

    user_message = f"""[참고 문서]
{context}

[질문]
{query}

위 문서 내용을 꼼꼼히 분석하여 질문에 답변해주세요. 문서에 있는 실제 정보를 인용해서 답변하세요."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error in chat_with_context: {e}")
        traceback.print_exc()
        raise
