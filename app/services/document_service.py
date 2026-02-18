try:
    from azure.ai.formrecognizer import DocumentAnalysisClient
    from azure.core.credentials import AzureKeyCredential
    AZURE_DOCINTEL_AVAILABLE = True
except Exception:
    DocumentAnalysisClient = None  # type: ignore[assignment]
    AzureKeyCredential = None  # type: ignore[assignment]
    AZURE_DOCINTEL_AVAILABLE = False

from app.config import AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT, AZURE_DOCUMENT_INTELLIGENCE_KEY

from io import BytesIO
try:
    from docx import Document
    DOCX_AVAILABLE = True
except Exception:
    Document = None  # type: ignore[assignment]
    DOCX_AVAILABLE = False

def get_document_client():
    if not AZURE_DOCINTEL_AVAILABLE:
        raise RuntimeError("azure-ai-formrecognizer dependencies are not installed")
    return DocumentAnalysisClient(
        endpoint=AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
        credential=AzureKeyCredential(AZURE_DOCUMENT_INTELLIGENCE_KEY)
    )

def extract_text_from_url(blob_url: str) -> str:
    client = get_document_client()
    poller = client.begin_analyze_document_from_url("prebuilt-read", blob_url)
    result = poller.result()
    
    text = ""
    for page in result.pages:
        for line in page.lines:
            text += line.content + "\n"
    
    return text

def extract_text_from_docx(file_data: bytes) -> str:
    """
    python-docx 라이브러리를 사용하여 메모리 상의 docx 파일에서 텍스트를 추출합니다.
    Azure API를 타지 않으므로 빠르고 비용이 들지 않습니다.
    """
    try:
        if not DOCX_AVAILABLE:
            raise RuntimeError("python-docx dependency is not installed")
        print("[DocService] Extracting text locally using python-docx...")
        doc = Document(BytesIO(file_data))
        full_text = []
        for para in doc.paragraphs:
            full_text.append(para.text)
        
        extracted_text = '\n'.join(full_text)
        print(f"[DocService] Local extraction complete. Extracted {len(extracted_text)} characters.")
        return extracted_text
    except Exception as e:
        print(f"[DocService] Error extracting text from docx: {e}")
        raise e
