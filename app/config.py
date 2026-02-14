import os
from dotenv import load_dotenv

# proto.env 파일 경로 지정
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), "proto.env"))

# Storage Account
AZURE_STORAGE_ACCOUNT_NAME = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
AZURE_STORAGE_ACCOUNT_KEY = os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
AZURE_STORAGE_CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "kkuldanji-mvp-raw")
AZURE_STORAGE_PROCESSED_CONTAINER_NAME = os.getenv("AZURE_STORAGE_PROCESSED_CONTAINER_NAME", "kkuldanji-mvp-processed")

# Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
AZURE_DOCUMENT_INTELLIGENCE_KEY = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")

# AI Search
AZURE_SEARCH_SERVICE_ENDPOINT = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT")
AZURE_SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
AZURE_SEARCH_ADMIN_KEY = os.getenv("AZURE_SEARCH_ADMIN_KEY")
AZURE_SEARCH_KEY = os.getenv("AZURE_SEARCH_KEY")
AZURE_SEARCH_INDEX_NAME = os.getenv("AZURE_SEARCH_INDEX_NAME", "kkuldanji-mvp")

# Azure OpenAI
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_CHAT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")
AZURE_OPENAI_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-large")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

# Google Gemini (추가)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")

# ===== NEW: Key Vault 설정 =====

KEYVAULT_URL = os.getenv("KEYVAULT_URL", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ===== NEW: Key Vault 클라이언트 초기화 =====

from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

def get_credential():
    """Azure 자격증명 가져오기"""
    if ENVIRONMENT == "development":
        # 로컬 개발: Azure CLI 자격증명 사용
        # 먼저 `az login` 실행해야 함
        return DefaultAzureCredential()
    else:
        # 프로덕션: Managed Identity 사용
        return DefaultAzureCredential()

_keyvault_client = None

def get_keyvault_client():
    """Key Vault 클라이언트 (싱글톤)"""
    global _keyvault_client
    if not KEYVAULT_URL:
        return None
    if _keyvault_client is None:
        try:
            credential = get_credential()
            _keyvault_client = SecretClient(vault_url=KEYVAULT_URL, credential=credential)
            print(f"✅ Key Vault 연결 성공: {KEYVAULT_URL}")
        except Exception as e:
            print(f"⚠️ Key Vault 연결 실패: {e}")
    return _keyvault_client

def get_secret(secret_name: str) -> str:
    """Key Vault에서 시크릿 가져오기 (캐싱 없음)"""
    
    # 로컬 개발: 먼저 .env에서 확인
    if ENVIRONMENT == "development":
        env_value = os.getenv(secret_name)
        if env_value:
            return env_value
    
    # Key Vault에서 가져오기
    try:
        client = get_keyvault_client()
        if client:
            secret = client.get_secret(secret_name)
            return secret.value
    except Exception as e:
        print(f"⚠️ Key Vault에서 {secret_name} 조회 실패: {e}")
    
    # 환경변수에도 없고 Key Vault도 실패 시
    if ENVIRONMENT == "development":
        return ""  # 개발 환경에서는 빈 문자열 반환
    else:
        raise Exception(f"필수 시크릿 {secret_name}을(를) 찾을 수 없습니다")

# ===== 환경변수 검증 (기존) =====

def validate_config():
    """필수 환경변수 확인"""
    required = [
        ("AZURE_STORAGE_ACCOUNT_NAME", AZURE_STORAGE_ACCOUNT_NAME),
        ("AZURE_STORAGE_ACCOUNT_KEY", AZURE_STORAGE_ACCOUNT_KEY),
        ("AZURE_OPENAI_ENDPOINT", AZURE_OPENAI_ENDPOINT),
        ("AZURE_OPENAI_API_KEY", AZURE_OPENAI_API_KEY),
        ("AZURE_SEARCH_ENDPOINT", AZURE_SEARCH_ENDPOINT),
        ("AZURE_SEARCH_KEY", AZURE_SEARCH_KEY),
        ("AZURE_SEARCH_INDEX_NAME", AZURE_SEARCH_INDEX_NAME),
    ]
    
    missing = [name for name, value in required if not value]
    if missing:
        print(f"⚠️ Missing environment variables: {', '.join(missing)}")
        print("   Please check your proto.env file")
    return len(missing) == 0
