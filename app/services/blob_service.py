try:
    from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
    from azure.identity import DefaultAzureCredential
    AZURE_BLOB_AVAILABLE = True
except Exception:
    BlobServiceClient = None  # type: ignore[assignment]
    BlobSasPermissions = None  # type: ignore[assignment]
    generate_blob_sas = None  # type: ignore[assignment]
    DefaultAzureCredential = None  # type: ignore[assignment]
    AZURE_BLOB_AVAILABLE = False

from datetime import datetime, timedelta, timezone
from app.config import AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, ENVIRONMENT

# ===== Blob 클라이언트 초기화 =====

_blob_client = None

def get_blob_client():
    """Blob Service Client (싱글톤)"""
    global _blob_client
    if not AZURE_BLOB_AVAILABLE:
        raise RuntimeError("azure-storage-blob dependencies are not installed")
    if _blob_client is None:
        if ENVIRONMENT == "development":
            # 로컬: 연결 문자열 사용
            connection_string = f"DefaultEndpointsProtocol=https;AccountName={AZURE_STORAGE_ACCOUNT_NAME};AccountKey={AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net"
            _blob_client = BlobServiceClient.from_connection_string(connection_string)
        else:
            # 프로덕션: Managed Identity 사용
            credential = DefaultAzureCredential()
            _blob_client = BlobServiceClient(
                account_url=f"https://{AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net",
                credential=credential
            )
    return _blob_client

# ===== 기존 함수들 (유지) =====

def upload_to_blob(file_name: str, file_data: bytes, index_name: str = None):
    """
    Blob Storage에 파일 업로드
    SAS Token이 포함된 URL 반환

    Args:
        file_name: 업로드할 파일명
        file_data: 파일 데이터
        index_name: RAG 인덱스 이름 (None이면 기본 컨테이너 사용)
    """
    # 인덱스 이름에 따른 동적 컨테이너명 생성
    if index_name:
        # 인덱스명에서 특수문자 제거 및 소문자 변환 (Azure Blob 컨테이너 명명 규칙)
        safe_index = index_name.lower().replace('_', '-').replace(' ', '-')
        container_name = f"{safe_index}-raw"
    else:
        container_name = "kkuldanji-mvp-raw"  # 기본값

    print(f"📦 Using blob container: {container_name}")
    
    try:
        client = get_blob_client()
        container_client = client.get_container_client(container_name)
        
        # 파일 업로드
        blob_client = container_client.get_blob_client(file_name)
        
        # 컨테이너가 없으면 생성
        try:
            if not container_client.exists():
                print(f"📁 Creating container: {container_name}")
                container_client.create_container()
        except Exception as e:
            print(f"⚠️ Container creation check failed: {e}")

        blob_client.upload_blob(file_data, overwrite=True)
        
        # SAS Token 생성 (1시간 유효)
        sas_token = generate_blob_sas(
            account_name=AZURE_STORAGE_ACCOUNT_NAME,
            container_name=container_name,
            blob_name=file_name,
            account_key=AZURE_STORAGE_ACCOUNT_KEY,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        
        blob_url_with_sas = f"https://{AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{container_name}/{file_name}?{sas_token}"
        
        return blob_url_with_sas
    
    except Exception as e:
        print(f"❌ Blob upload failed: {e}")
        raise

def save_processed_json(file_name: str, json_str: str, index_name: str = None):
    """
    처리된 JSON을 Blob Storage에 저장

    Args:
        file_name: 저장할 파일명
        json_str: JSON 문자열
        index_name: RAG 인덱스 이름 (None이면 기본 컨테이너 사용)
    """
    # 인덱스 이름에 따른 동적 컨테이너명 생성
    if index_name:
        safe_index = index_name.lower().replace('_', '-').replace(' ', '-')
        container_name = f"{safe_index}-processed"
    else:
        container_name = "kkuldanji-mvp-processed"  # 기본값

    print(f"📦 Using processed container: {container_name}")
    
    try:
        client = get_blob_client()
        container_client = client.get_container_client(container_name)
        
        blob_client = container_client.get_blob_client(file_name)
        
        # 컨테이너가 없으면 생성
        try:
            if not container_client.exists():
                print(f"📁 Creating container: {container_name}")
                container_client.create_container()
        except Exception as e:
            print(f"⚠️ Container creation check failed: {e}")

        blob_client.upload_blob(json_str.encode('utf-8'), overwrite=True)
        
        print(f"✅ Processed JSON saved: {file_name}")
    
    except Exception as e:
        print(f"⚠️ Failed to save processed JSON: {e}")
        raise
