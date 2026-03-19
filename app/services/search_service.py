try:
    from azure.search.documents import SearchClient
    from azure.search.documents.indexes import SearchIndexClient
    from azure.search.documents.indexes.models import (
        SearchIndex,
        SimpleField,
        SearchableField,
        SearchFieldDataType,
        VectorSearch,
        HnswAlgorithmConfiguration,
        VectorSearchProfile,
        SearchField,
        SemanticConfiguration,
        SemanticPrioritizedFields,
        SemanticField,
        SemanticSearch,
    )
    from azure.core.credentials import AzureKeyCredential
    AZURE_SEARCH_AVAILABLE = True
except Exception:
    SearchClient = None  # type: ignore[assignment]
    SearchIndexClient = None  # type: ignore[assignment]
    SearchIndex = None  # type: ignore[assignment]
    SimpleField = None  # type: ignore[assignment]
    SearchableField = None  # type: ignore[assignment]
    SearchFieldDataType = None  # type: ignore[assignment]
    VectorSearch = None  # type: ignore[assignment]
    HnswAlgorithmConfiguration = None  # type: ignore[assignment]
    VectorSearchProfile = None  # type: ignore[assignment]
    SearchField = None  # type: ignore[assignment]
    SemanticConfiguration = None  # type: ignore[assignment]
    SemanticPrioritizedFields = None  # type: ignore[assignment]
    SemanticField = None  # type: ignore[assignment]
    SemanticSearch = None  # type: ignore[assignment]
    AzureKeyCredential = None  # type: ignore[assignment]
    AZURE_SEARCH_AVAILABLE = False
from app.config import (
    AZURE_SEARCH_ENDPOINT,
    AZURE_SEARCH_KEY,
    AZURE_SEARCH_INDEX_NAME,
    AZURE_SEARCH_ADMIN_KEY,
    AZURE_SEARCH_SERVICE_ENDPOINT,
    is_demo_mode,
)
from app.services.openai_service import get_embedding
import traceback

DEFAULT_INDEX_NAME = AZURE_SEARCH_INDEX_NAME

"""
def get_search_index_client():
    return SearchIndexClient(
        endpoint=AZURE_SEARCH_ENDPOINT,
        credential=AzureKeyCredential(AZURE_SEARCH_KEY)
    )

def get_search_client(index_name: str = None):
    if index_name is None:
        index_name = INDEX_NAME
    return SearchClient(
        endpoint=AZURE_SEARCH_ENDPOINT,
        index_name=index_name,
        credential=AzureKeyCredential(AZURE_SEARCH_KEY)
    )
"""

def get_search_client(index_name: str = None):
    if not AZURE_SEARCH_AVAILABLE:
        raise RuntimeError("azure-search-documents dependencies are not installed")
    endpoint = AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_SERVICE_ENDPOINT
    if not endpoint or not AZURE_SEARCH_KEY:
        raise RuntimeError(
            "Azure AI Search is not configured. "
            "Set AZURE_SEARCH_ENDPOINT (or AZURE_SEARCH_SERVICE_ENDPOINT) and AZURE_SEARCH_KEY."
        )

    return SearchClient(
        endpoint=endpoint,
        index_name=index_name or DEFAULT_INDEX_NAME,
        credential=AzureKeyCredential(AZURE_SEARCH_KEY),
    )

def get_search_index_client():
    if not AZURE_SEARCH_AVAILABLE:
        raise RuntimeError("azure-search-documents dependencies are not installed")
    endpoint = AZURE_SEARCH_SERVICE_ENDPOINT or AZURE_SEARCH_ENDPOINT
    admin_key = AZURE_SEARCH_ADMIN_KEY or AZURE_SEARCH_KEY
    if not endpoint or not admin_key:
        raise RuntimeError(
            "Azure AI Search index admin is not configured. "
            "Set AZURE_SEARCH_SERVICE_ENDPOINT and AZURE_SEARCH_ADMIN_KEY (preferred), "
            "or provide AZURE_SEARCH_ENDPOINT/AZURE_SEARCH_KEY with sufficient permissions."
        )

    return SearchIndexClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(admin_key),
    )


def create_index_if_not_exists(index_name: str = None):
    index_client = get_search_index_client()
    target_index = index_name or DEFAULT_INDEX_NAME
    
    try:
        index_client.get_index(target_index)
        return
    except Exception:
        pass
    
    fields = [
        # 1. Core Vector & Content (RAG Performance)
        SearchField(
            name="content_vector",
            type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
            searchable=True,
            vector_search_dimensions=3072,
            vector_search_profile_name="my-vector-profile"
        ),
        SearchableField(name="content", type=SearchFieldDataType.String, analyzer_name="ko.lucene"),
        SearchableField(name="parentSummary", type=SearchFieldDataType.String, analyzer_name="ko.lucene"),
        SearchableField(name="chunkSummary", type=SearchFieldDataType.String, analyzer_name="ko.lucene"),
        SearchableField(name="codeExplanation", type=SearchFieldDataType.String, analyzer_name="ko.lucene"),
        SearchableField(name="designIntent", type=SearchFieldDataType.String, analyzer_name="ko.lucene"),
        SearchableField(name="handoverNotes", type=SearchFieldDataType.String, analyzer_name="ko.lucene"),
        SearchField(name="codeComments", type=SearchFieldDataType.Collection(SearchFieldDataType.String), searchable=True, analyzer_name="ko.lucene"),

        # 2. Filtering & Metadata
        SimpleField(name="processedDate", type=SearchFieldDataType.DateTimeOffset, sortable=True, filterable=True),
        SearchableField(name="paraCategory", type=SearchFieldDataType.String, filterable=True, facetable=True),
        SearchableField(name="fileType", type=SearchFieldDataType.String, filterable=True, facetable=True),
        SearchableField(name="language", type=SearchFieldDataType.String, filterable=True, facetable=True),
        SearchableField(name="framework", type=SearchFieldDataType.String, filterable=True, facetable=True),
        SearchableField(name="serviceDomain", type=SearchFieldDataType.String, filterable=True, facetable=True),
        SimpleField(name="isArchived", type=SearchFieldDataType.Boolean, filterable=True, facetable=True),
        SearchField(name="tags", type=SearchFieldDataType.Collection(SearchFieldDataType.String), searchable=True, filterable=True, facetable=True, analyzer_name="standard.lucene"),
        SearchField(name="relatedSection", type=SearchFieldDataType.Collection(SearchFieldDataType.String), searchable=True, filterable=True, analyzer_name="standard.lucene"),

        # 3. Identifiers & Location
        SimpleField(name="id", type=SearchFieldDataType.String, key=True, filterable=True),
        SimpleField(name="parentId", type=SearchFieldDataType.String, filterable=True),
        SearchableField(name="fileName", type=SearchFieldDataType.String, filterable=True, analyzer_name="standard.lucene"),
        SearchableField(name="filePath", type=SearchFieldDataType.String, filterable=True, analyzer_name="standard.lucene"),
        SimpleField(name="url", type=SearchFieldDataType.String),

        # 4. Payload (LLM Reference - Not Searchable)
        SimpleField(name="chunkMeta", type=SearchFieldDataType.String), # JSON string
        SimpleField(name="codeMetadata", type=SearchFieldDataType.String),
        SimpleField(name="involvedPeople", type=SearchFieldDataType.String),
        SimpleField(name="rawCode", type=SearchFieldDataType.String), # Not searchable
        SearchField(name="relatedFiles", type=SearchFieldDataType.Collection(SearchFieldDataType.String), searchable=False),
    ]
    
    # Define semantic search configuration
    semantic_config = SemanticConfiguration(
        name="my-semantic-config",
        prioritized_fields=SemanticPrioritizedFields(
            title_field=SemanticField(field_name="fileName"),
            content_fields=[
                SemanticField(field_name="content"),
                SemanticField(field_name="parentSummary")
            ],
            keywords_fields=[
                SemanticField(field_name="tags"),
                SemanticField(field_name="paraCategory")
            ]
        )
    )
    
    vector_search = VectorSearch(
        algorithms=[
            HnswAlgorithmConfiguration(name="my-hnsw")
        ],
        profiles=[
            VectorSearchProfile(
                name="my-vector-profile",
                algorithm_configuration_name="my-hnsw"
            )
        ]
    )
    
    semantic_search = SemanticSearch(configurations=[semantic_config])
    
    index = SearchIndex(name=target_index, fields=fields, vector_search=vector_search, semantic_search=semantic_search)
    index_client.create_index(index)

def add_document_to_index(doc_id: str, content: str, file_name: str, index_name: str = None):
    """Upload a single document (mainly for quick experiments)."""
    create_index_if_not_exists(index_name=index_name)
    search_client = get_search_client(index_name=index_name)
    
    max_length = 8000
    if len(content) > max_length:
        content = content[:max_length]
    
    embedding = get_embedding(content)
    
    document = {
        "id": doc_id,
        "content": content,
        # Index schema uses camelCase; keep API responses snake_case separately.
        "fileName": file_name,
        "content_vector": embedding
    }
    
    search_client.upload_documents([document])

def index_processed_chunks(chunks: list, index_name: str = None):
    """
    LLM 전처리가 완료된 청크 리스트(메모리 상의 객체)를 받아 Azure Search에 업로드합니다.
    인덱스가 없으면 자동으로 생성합니다.

    Args:
        chunks: 인덱싱할 청크 리스트
        index_name: RAG 인덱스 이름 (None이면 기본 인덱스 사용)
    """
    if not chunks:
        print("[Warning] No chunks to index.")
        return 0

    target_index = index_name or DEFAULT_INDEX_NAME
    print(f"🔍 Target index: {target_index}")

    search_client = get_search_client(index_name=index_name)
    documents_batch = []
    count = 0

    print(f"[Info] Indexing {len(chunks)} chunks to '{target_index}'...")

    # Helper functions for type safety
    def ensure_list_str(value):
        """Ensure the value is a list of strings."""
        if value is None:
            return []
        if isinstance(value, list):
            return [str(v) for v in value]
        if isinstance(value, str):
            if not value.strip():
                return []
            if ',' in value:
                return [v.strip() for v in value.split(',')]
            return [value]
        return [str(value)]

    def ensure_string(value):
        """Ensure the value is a string."""
        if isinstance(value, str):
            return value
        if value is None:
            return ""
        return str(value)

    for item in chunks:
        # ... (기존 임베딩 생성 및 문서 매핑 로직 유지) ...
        try:
            # 1. 임베딩 생성 (ingest_data.py와 동일 로직)
            parent_summary = item.get("parentSummary", "")
            content = item.get("content", "")
            
            # 임베딩 입력 텍스트 조합
            embedding_input = f"파일 전체 요약: {parent_summary}\n\n 상세 본문: {content}"
            
            # 임베딩 생성
            vector = get_embedding(embedding_input)
            
            if not vector:
                print(f"[Warning] Skipping chunk {item.get('id')}: Embedding failed.")
                continue

            # 2. 필드 매핑
            document = {
                # Core Vector & Content
                "content_vector": vector,
                "content": ensure_string(content),
                "parentSummary": ensure_string(parent_summary),
                "chunkSummary": ensure_string(item.get("chunkSummary")),
                "codeExplanation": ensure_string(item.get("codeExplanation")),
                "designIntent": ensure_string(item.get("designIntent")),
                "handoverNotes": ensure_string(item.get("handoverNotes")),
                "codeComments": ensure_list_str(item.get("codeComments")),

                # Filtering & Metadata
                "processedDate": item.get("processedDate"),
                "paraCategory": ensure_string(item.get("paraCategory")),
                "fileType": ensure_string(item.get("fileType")),
                "language": ensure_string(item.get("language")),
                "framework": ensure_string(item.get("framework")),
                "serviceDomain": ensure_string(item.get("serviceDomain")),
                "isArchived": item.get("isArchived", False),
                "tags": ensure_list_str(item.get("tags")),
                "relatedSection": ensure_list_str(item.get("relatedSection")),

                # Identifiers
                "id": item.get("id"),
                "parentId": ensure_string(item.get("parentId")),
                "fileName": ensure_string(item.get("fileName")),
                "filePath": ensure_string(item.get("filePath")),
                "url": ensure_string(item.get("url")),

                # Payload (Stringified JSON)
                "chunkMeta": ensure_string(item.get("chunkMeta")) if isinstance(item.get("chunkMeta"), str) else str(item.get("chunkMeta", {})),
                "codeMetadata": ensure_string(item.get("codeMetadata")) if isinstance(item.get("codeMetadata"), str) else str(item.get("codeMetadata", {})),
                "involvedPeople": ensure_string(item.get("involvedPeople")) if isinstance(item.get("involvedPeople"), str) else str(item.get("involvedPeople", [])),
                "rawCode": ensure_string(item.get("rawCode")),
                "relatedFiles": ensure_list_str(item.get("relatedFiles"))
            }

            documents_batch.append(document)
            count += 1

        except Exception as e:
            print(f"❌ Error preparing chunk {item.get('id')}: {e}")
            traceback.print_exc()
 
    # 3. 배치 업로드
    if documents_batch:
        try:
            result = search_client.upload_documents(documents=documents_batch)
            if not all(r.succeeded for r in result):
                print("[Warning] Some documents failed to upload.")
            else:
                print(f"[Success] Successfully indexed {len(documents_batch)} documents.")
        except Exception as e:
            # 인덱스가 없어서 실패한 경우 (ResourceNotFoundError)
            if "The index" in str(e) and "was not found" in str(e):
                print(f"⚠️ Index not found. Attempting to create index '{target_index}'...")
                try:
                    create_index_if_not_exists(index_name=target_index)
                    print("✅ Index created. Retrying upload...")

                    result = search_client.upload_documents(documents=documents_batch)
                    print(f"[Success] Successfully indexed {len(documents_batch)} documents (after creation).")
                except Exception as create_error:
                    print(f"❌ Failed to create index automatically: {create_error}")
                    raise e
            else:
                print(f"[Error] Error uploading batch to Search: {e}")
                traceback.print_exc()
                raise e
            
    return count

def search_documents(query: str, filters: dict = None, top_k: int = 5, index_name: str = None):
    """
    하이브리드 검색 수행 (Vector + Semantic + Keyword)

    Args:
        query: 검색 쿼리
        filters: 필터 조건
        top_k: 반환할 최대 결과 수
        index_name: 검색할 RAG 인덱스 이름 (None이면 기본 인덱스)
    """
    if is_demo_mode():
        from app.services import demo_store

        return demo_store.search_documents(query, top_k=top_k, index_name=index_name)

    from azure.search.documents.models import VectorizedQuery

    target_index = index_name or DEFAULT_INDEX_NAME
    print(f"🔍 Searching in index: {target_index}")

    search_client = get_search_client(index_name=index_name)
    query_embedding = get_embedding(query)

    vector_query = VectorizedQuery(
        vector=query_embedding,
        k_nearest_neighbors=top_k,
        fields="content_vector"
    )

    # 필터 구성 (필요 시 확장)
    filter_expression = None
    if filters:
        # 예: category eq 'Backend'
        pass

    try:
        results = search_client.search(
            search_text=query,
            vector_queries=[vector_query],
            top=top_k,
            filter=filter_expression,
            include_total_count=True,
            # Use the semantic configuration created in `create_index_if_not_exists()`.
            query_type="semantic",
            semantic_configuration_name="my-semantic-config"
        )

        docs = []
        for result in results:
            file_name = result.get("fileName") or result.get("file_name") or ""
            docs.append({
                "id": result.get("id"),
                "content": result.get("content"),
                # Keep both keys to avoid breaking older API consumers/frontends.
                "fileName": file_name,
                "file_name": file_name,
                "parentSummary": result.get("parentSummary"),
                "chunkSummary": result.get("chunkSummary"),
                "score": result.get("@search.score"),
                "reranker_score": result.get("@search.reranker_score")
            })
        
        return docs

    except Exception as e:
        print(f"[Error] Search failed: {e}")
        traceback.print_exc()
        return []
    
def get_document_count(index_name: str = None) -> int:
    """AI Search 인덱스의 총 문서 개수 조회"""
    if is_demo_mode():
        from app.services import demo_store

        return demo_store.get_document_count(index_name)

    try:
        search_client = get_search_client(index_name)
        results = search_client.search(
            search_text="*",
            include_total_count=True,
            top=1
        )
        count = results.get_count()
        print(f"📊 인덱스 '{index_name or DEFAULT_INDEX_NAME}' 문서 개수: {count}")
        return count if count else 0
    except Exception as e:
        print(f"⚠️  문서 개수 조회 실패: {e}")
        traceback.print_exc()
        return 0

def get_all_documents(index_name: str = None) -> list:
    """AI Search 인덱스의 모든 문서 목록 조회"""
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
        return out

    try:
        search_client = get_search_client(index_name=index_name)
        results = search_client.search(
            search_text="*",
            include_total_count=True,
            top=1000
        )
        docs = []
        for result in results:
            file_name = result.get("fileName") or result.get("file_name") or "Unknown"
            docs.append({
                "id": result["id"],
                "file_name": file_name,
                "content": result.get("content", ""),
                "content_length": len(result.get("content", ""))
            })
        print(f"📋 인덱싱된 문서 목록: {len(docs)}개")
        for doc in docs:
            print(f"   - {doc['file_name']} (ID: {doc['id']}, 길이: {doc['content_length']})")
        return docs
    except Exception as e:
        print(f"⚠️  문서 목록 조회 실패: {e}")
        traceback.print_exc()
        return []
