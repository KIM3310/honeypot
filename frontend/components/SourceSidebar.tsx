import {
  Archive,
  ChevronDown,
  Database,
  File as FileIcon,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_ENDPOINTS } from "../config/api";
import { fetchWithSession } from "../services/sessionFetch";
import type { SourceFile } from "../types.ts";
import { getLlmHeaders } from "../utils/llmConfig";

interface Props {
  onIndexChange?: (indexName: string) => void;
  files: SourceFile[];
  onUpload: (newFiles: SourceFile[]) => void;
  onUpdate: (id: string, patch: Partial<SourceFile>) => void;
  onRemove: (id: string) => void;
}

const SourceSidebar: React.FC<Props> = ({ files, onUpload, onUpdate, onRemove, onIndexChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const cancelledFileIdsRef = useRef<Set<string>>(new Set());

  // RAG 인덱스 선택 (단일 선택)
  const [selectedIndex, setSelectedIndex] = useState<string>("");
  const [availableIndexes, setAvailableIndexes] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const UPLOAD_CONCURRENCY = 2;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 백엔드에서 RAG 인덱스 목록 가져오기
  useEffect(() => {
    const fetchIndexes = async () => {
      try {
        const response = await fetchWithSession(API_ENDPOINTS.INDEXES);
        if (response.ok) {
          const data = await response.json();
          const indexNames = data.indexes.map((idx: any) => idx.name);
          setAvailableIndexes(indexNames);

          // 기본 인덱스 선택 (첫 번째 인덱스 또는 documents-index)
          if (indexNames.length > 0) {
            const defaultIndex = indexNames.find((name: string) => name === "documents-index") || indexNames[0];
            setSelectedIndex(defaultIndex);
            if (onIndexChange) {
              onIndexChange(defaultIndex);
            }
          }

          console.log("✅ RAG 인덱스 목록 로드:", indexNames);
        }
      } catch (error) {
        console.error("❌ RAG 인덱스 목록 조회 실패:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`인덱스 목록을 가져올 수 없습니다: ${errorMsg}`);
      }
    };

    fetchIndexes();
  }, [onIndexChange]);

  const pollTaskStatus = async (fileId: string, taskId: string): Promise<void> => {
    const maxPolls = 120; // about 3 minutes at 1.5s interval
    for (let i = 0; i < maxPolls; i++) {
      if (!isMountedRef.current || cancelledFileIdsRef.current.has(fileId)) {
        return;
      }
      try {
        const response = await fetchWithSession(`${API_ENDPOINTS.UPLOAD}/status/${encodeURIComponent(taskId)}`);
        if (!response.ok) {
          throw new Error(`status check failed (${response.status})`);
        }
        const data = await response.json();
        const status = String(data.status || "processing");
        const progress = Number(data.progress || 0);
        const message = String(data.message || "");

        if (!isMountedRef.current || cancelledFileIdsRef.current.has(fileId)) {
          return;
        }

        onUpdate(fileId, {
          uploadStatus: status as SourceFile["uploadStatus"],
          uploadProgress: Math.max(0, Math.min(100, progress)),
          uploadMessage: message,
          content: `[${status}] ${message}`,
        });

        if (status === "completed" || status === "completed_with_warning" || status === "failed") {
          return;
        }
      } catch (error) {
        if (!isMountedRef.current || cancelledFileIdsRef.current.has(fileId)) {
          return;
        }
        const errorMsg = error instanceof Error ? error.message : String(error);
        onUpdate(fileId, {
          uploadStatus: "failed",
          uploadMessage: `상태 조회 실패: ${errorMsg}`,
          content: `[failed] 상태 조회 실패: ${errorMsg}`,
        });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!isMountedRef.current || cancelledFileIdsRef.current.has(fileId)) {
      return;
    }
    onUpdate(fileId, {
      uploadStatus: "failed",
      uploadMessage: "업로드 상태 확인 시간 초과",
      content: "[failed] 업로드 상태 확인 시간 초과",
    });
  };

  const uploadSingleFile = async (entry: SourceFile, rawFile: globalThis.File): Promise<void> => {
    const formData = new FormData();
    formData.append("file", rawFile);
    if (selectedIndex) {
      formData.append("index_name", selectedIndex);
    }

    try {
      cancelledFileIdsRef.current.delete(entry.id);
      onUpdate(entry.id, {
        uploadStatus: "processing",
        uploadProgress: 5,
        uploadMessage: "업로드 요청 전송 중...",
      });
      console.log(`📤 업로드 시작: ${rawFile.name} → 인덱스: ${selectedIndex || "default"}`);

      const response = await fetchWithSession(API_ENDPOINTS.UPLOAD, {
        method: "POST",
        headers: getLlmHeaders(),
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.detail || response.statusText || "upload failed"));
      }

      const taskId = String(payload.task_id || "");
      if (!taskId) {
        throw new Error("task_id가 응답에 없습니다.");
      }
      console.log(`✅ 업로드 접수: ${rawFile.name}, task_id: ${taskId}`);
      onUpdate(entry.id, {
        uploadTaskId: taskId,
        uploadStatus: "processing",
        uploadProgress: 10,
        uploadMessage: "백그라운드 처리 시작",
        content: `[processing] 업로드 완료 - 백그라운드 처리 중 (Task ID: ${taskId})`,
      });

      await pollTaskStatus(entry.id, taskId);
    } catch (error) {
      if (!isMountedRef.current || cancelledFileIdsRef.current.has(entry.id)) {
        return;
      }
      console.error("❌ 파일 업로드 실패:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      onUpdate(entry.id, {
        uploadStatus: "failed",
        uploadProgress: 0,
        uploadMessage: `업로드 실패: ${errorMsg}`,
        content: `[failed] 업로드 실패: ${errorMsg}`,
      });
      alert(`파일 업로드에 실패했습니다: ${rawFile.name}\n\n${errorMsg}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const entries: SourceFile[] = selectedFiles.map((file) => ({
        id: Math.random().toString(36).slice(2, 11),
        name: file.name,
        type: file.type,
        content: "[pending] 업로드 대기 중",
        mimeType: file.type,
        uploadStatus: "pending",
        uploadProgress: 0,
        uploadMessage: "업로드 대기 중",
      }));
      onUpload(entries);
      const workerCount = Math.min(UPLOAD_CONCURRENCY, entries.length);
      let cursor = 0;
      const workers = Array.from({ length: workerCount }, async () => {
        while (cursor < entries.length) {
          const current = cursor;
          cursor += 1;
          await uploadSingleFile(entries[current], selectedFiles[current]);
        }
      });
      void Promise.all(workers);
    }
    e.target.value = "";
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");

  const getUploadTone = (status: SourceFile["uploadStatus"]) => {
    if (status === "completed") return "text-emerald-600";
    if (status === "completed_with_warning") return "text-amber-600";
    if (status === "failed") return "text-red-600";
    return "text-yellow-600";
  };

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter((file) => {
      const haystack = `${file.name} ${file.type} ${file.uploadMessage || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [files, searchQuery]);

  const uploadSummary = useMemo(() => {
    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;
    for (const file of files) {
      const status = file.uploadStatus;
      if (status === "completed" || status === "completed_with_warning") completed += 1;
      else if (status === "failed") failed += 1;
      else if (status === "processing") processing += 1;
      else if (status === "pending") pending += 1;
    }
    return { pending, processing, completed, failed };
  }, [files]);

  return (
    <div className="w-80 h-full bg-white border-r flex flex-col p-5 shadow-sm relative overflow-hidden">
      <div className="mb-8 flex items-center gap-3 relative z-10">
        <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-white shadow-lg rotate-3 border-2 border-yellow-500">
          <span className="text-2xl">🍯</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-800 tracking-tight">꿀단지</h1>
          <p className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest">Sweet Handover AI</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-5 relative z-10">
        <div className="bg-yellow-400 rounded-2xl p-5 text-white shadow-md border-b-4 border-yellow-500">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Archive className="w-4 h-4" /> 자료 보관함
          </h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-white text-yellow-600 hover:bg-yellow-50 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-5 h-5" />
            자료 추가하기
          </button>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".txt,.md,.text,.pdf,.docx,.py,.js,.java,.c,.cpp,.h,.cs,.ts,.tsx,.html,.css,.json,application/pdf"
          />
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="자료 검색..."
            className="w-full pl-11 pr-4 py-3 bg-yellow-50 border border-yellow-100 rounded-2xl text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all placeholder:text-yellow-300"
          />
        </div>

        <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400 px-2">
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-yellow-500 transition-colors">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            <span>웹 검색</span>
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-yellow-500 transition-colors">
            <span className="w-2 h-2 rounded-full bg-gray-200"></span>
            <span>심층 분석</span>
          </div>
        </div>

        {/* 지식보관소 선택 - 드롭다운 방식 */}
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Database className="w-3 h-3 text-yellow-500" /> 지식보관소 선택
          </h3>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-yellow-400 transition-all flex items-center justify-between"
            >
              <span className="truncate">{selectedIndex || "인덱스를 선택하세요"}</span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20">
                {availableIndexes.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">사용 가능한 인덱스가 없습니다</div>
                ) : (
                  availableIndexes.map((indexName) => (
                    <button
                      key={indexName}
                      onClick={() => {
                        setSelectedIndex(indexName);
                        setIsDropdownOpen(false);
                        if (onIndexChange) {
                          onIndexChange(indexName);
                        }
                        console.log("✅ RAG 인덱스 선택:", indexName);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                        selectedIndex === indexName ? "bg-yellow-50 text-yellow-600" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {indexName}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedIndex && (
            <div className="mt-2 px-3 py-1.5 bg-yellow-50 rounded-lg">
              <p className="text-[10px] font-bold text-yellow-600">현재 인덱스: {selectedIndex}</p>
            </div>
          )}
        </div>

        <div className="mt-2 space-y-2 overflow-y-auto pr-1 flex-1 no-scrollbar">
          <div className="mb-2 grid grid-cols-4 gap-2 text-[10px] font-bold">
            <div className="rounded-lg bg-gray-100 px-2 py-1 text-center text-gray-500">
              대기 {uploadSummary.pending}
            </div>
            <div className="rounded-lg bg-yellow-100 px-2 py-1 text-center text-yellow-700">
              처리 {uploadSummary.processing}
            </div>
            <div className="rounded-lg bg-emerald-100 px-2 py-1 text-center text-emerald-700">
              완료 {uploadSummary.completed}
            </div>
            <div className="rounded-lg bg-red-100 px-2 py-1 text-center text-red-700">실패 {uploadSummary.failed}</div>
          </div>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-4 grayscale opacity-30">🐝</div>
              <p className="text-gray-400 text-sm font-medium">
                {files.length === 0 ? "아직 저장된 자료가 없어요." : "검색 결과가 없습니다."}
              </p>
              <p className="text-gray-300 text-xs mt-1">
                {files.length === 0 ? (
                  <>
                    업무 매뉴얼이나 보고서를
                    <br />
                    추가해 보세요!
                  </>
                ) : (
                  <>다른 검색어로 다시 시도해 보세요.</>
                )}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-3 p-3 bg-gray-50 hover:bg-yellow-50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-yellow-100 shadow-sm hover:shadow-md"
              >
                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
                  {isImage(file.mimeType) ? (
                    <ImageIcon className="w-4 h-4 text-yellow-500" />
                  ) : (
                    <FileIcon className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-700 truncate">{file.name}</p>
                  <p className="text-[10px] text-yellow-500 font-bold uppercase">{file.type.split("/")[1] || "FILE"}</p>
                  {file.uploadStatus && (
                    <div className="mt-1.5">
                      <p className={`text-[10px] font-bold ${getUploadTone(file.uploadStatus)}`}>
                        {file.uploadMessage || file.uploadStatus}
                      </p>
                      {(file.uploadStatus === "pending" || file.uploadStatus === "processing") && (
                        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 transition-all duration-300"
                            style={{ width: `${Math.max(5, Math.min(100, file.uploadProgress || 0))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelledFileIdsRef.current.add(file.id);
                    onRemove(file.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all rounded-lg hover:bg-white"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SourceSidebar;
