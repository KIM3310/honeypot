import { getAuthHeaders } from "../utils/auth";
import React, { useRef, useState, useEffect } from "react";
import {
  Plus,
  Search,
  File,
  Trash2,
  Image as ImageIcon,
  Archive,
  Database,
  ChevronDown,
} from "lucide-react";
import { SourceFile } from "../types.ts";
import { API_ENDPOINTS, fetchWithRetry } from "../config/api";

interface Props {
  onIndexChange?: (indexName: string) => void;
  files: SourceFile[];
  onUpload: (newFiles: SourceFile[]) => void;
  onRemove: (id: string) => void;
}

const SourceSidebar: React.FC<Props> = ({
  files,
  onUpload,
  onRemove,
  onIndexChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // RAG 인덱스 선택 (단일 선택)
  const [selectedIndex, setSelectedIndex] = useState<string>("");
  const [availableIndexes, setAvailableIndexes] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 백엔드에서 RAG 인덱스 목록 가져오기
  useEffect(() => {
    const fetchIndexes = async () => {
      try {
        const response = await fetchWithRetry(API_ENDPOINTS.INDEXES);
        if (response.ok) {
          const data = await response.json();
          const indexNames = data.indexes.map((idx: any) => idx.name);
          setAvailableIndexes(indexNames);

          // 기본 인덱스 선택 (첫 번째 인덱스 또는 documents-index)
          if (indexNames.length > 0) {
            const defaultIndex =
              indexNames.find((name: string) => name === "documents-index") ||
              indexNames[0];
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
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: SourceFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        let content = "";

        // 텍스트 파일은 직접 읽기
        if (
          file.type === "text/plain" ||
          file.name.endsWith(".txt") ||
          file.name.endsWith(".md")
        ) {
          content = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result);
            };
            reader.readAsText(file);
          });
        } else if (
          file.type === "application/pdf" ||
          file.name.endsWith(".pdf")
        ) {
          // PDF 파일은 백엔드로 업로드 (OCR 처리)
          const formData = new FormData();
          formData.append("file", file);
          try {
            const headers = getAuthHeaders();
            delete headers["Content-Type"]; // FormData는 Content-Type 자동 설정

            const response = await fetchWithRetry(API_ENDPOINTS.UPLOAD, {
              method: "POST",
              headers: headers,
              body: formData,
            });

            if (!response.ok) {
              throw new Error(`Upload failed: ${response.statusText}`);
            }
            const data = await response.json();
            content = data.extracted_text || "[PDF 텍스트 추출 실패]";
            console.log("✅ PDF 텍스트 추출 완료:", file.name);
          } catch (error) {
            console.error("❌ PDF 업로드 실패:", error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            content = `[PDF 업로드 중 오류 발생: ${errorMsg}]`;
            alert(`PDF 파일 업로드에 실패했습니다.\n\n${errorMsg}`);
          }
        }

        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          content: content,
          mimeType: file.type,
        });
      }
      onUpload(newFiles);
    }
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");

  return (
    <div className="w-80 h-full bg-white border-r flex flex-col p-5 shadow-sm relative overflow-hidden">
      <div className="mb-8 flex items-center gap-3 relative z-10">
        <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-white shadow-lg rotate-3 border-2 border-yellow-500">
          <span className="text-2xl">🍯</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-800 tracking-tight">
            꿀단지
          </h1>
          <p className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest">
            Sweet Handover AI
          </p>
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
            accept=".txt,.md,.text,.pdf,application/pdf"
          />
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-400 w-4 h-4" />
          <input
            type="text"
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
              <span className="truncate">
                {selectedIndex || "인덱스를 선택하세요"}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20">
                {availableIndexes.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">
                    사용 가능한 인덱스가 없습니다
                  </div>
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
                        selectedIndex === indexName
                          ? "bg-yellow-50 text-yellow-600"
                          : "text-gray-700 hover:bg-gray-50"
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
              <p className="text-[10px] font-bold text-yellow-600">
                현재 인덱스: {selectedIndex}
              </p>
            </div>
          )}
        </div>

        <div className="mt-2 space-y-2 overflow-y-auto pr-1 flex-1 no-scrollbar">
          {files.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-4 grayscale opacity-30">🐝</div>
              <p className="text-gray-400 text-sm font-medium">
                아직 저장된 자료가 없어요.
              </p>
              <p className="text-gray-300 text-xs mt-1">
                업무 매뉴얼이나 보고서를
                <br />
                추가해 보세요!
              </p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-3 p-3 bg-gray-50 hover:bg-yellow-50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-yellow-100 shadow-sm hover:shadow-md"
              >
                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
                  {isImage(file.mimeType) ? (
                    <ImageIcon className="w-4 h-4 text-yellow-500" />
                  ) : (
                    <File className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-700 truncate">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-yellow-500 font-bold uppercase">
                    {file.type.split("/")[1] || "FILE"}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
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
