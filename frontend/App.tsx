import React, { useState, useEffect } from "react";
import {
  removeAllTokens,
  getTokenExpiresIn,
} from "./utils/auth";
import SourceSidebar from "./components/SourceSidebar";
import ChatWindow from "./components/ChatWindow";
import HandoverForm from "./components/HandoverForm";
import LoginScreen from "./components/LoginScreen";
import EngagementHub from "./components/EngagementHub";
import AdSenseSlot from "./components/AdSenseSlot";
import LlmApiKeyPanel from "./components/LlmApiKeyPanel";
import ServiceReadinessBoard from "./components/ServiceReadinessBoard";
import {
  SourceFile,
  ChatMessage,
  HandoverData,
  ViewMode,
  ChatSession,
  HandoverSchema,
  HealthSummary,
  ServiceMeta,
} from "./types";
import {
  analyzeFilesForHandover,
  chatWithAssistant,
} from "./services/assistantService";
import { API_ENDPOINTS, fetchWithTimeout } from "./config/api";
import { HandoverPrintTemplate } from "./components/HandoverPrintTemplate";
import { fetchWithSession } from "./services/sessionFetch";

const STORAGE_KEY_SESSIONS = "honeycomb_chat_sessions";
const STORAGE_KEY_CURRENT_SESSION = "honeycomb_current_session";

function buildStaticHealthSummary(): HealthSummary {
  return {
    status: "unknown",
    service: "honeypot",
    mode: "demo",
    config_valid: false,
    allowed_origins_count: 0,
    requests_total: 0,
    errors_total: 0,
    error_rate: 0,
    request_id: null,
    diagnostics: {
      runtime_mode: "demo",
      next_action: "Start the backend to inspect live runtime diagnostics.",
    },
    capabilities: [
      "document-ingest",
      "handover-chat",
      "ops-runtime-observability",
      "security-guardrails",
      "service-metadata-surface",
    ],
    links: {
      meta: "/api/meta",
      handover_schema: "/api/schema/handover",
      ops_runtime: "/api/ops/runtime",
    },
  };
}

function buildStaticServiceMeta(): ServiceMeta {
  return {
    service: "honeypot",
    contract_version: "honeypot-service-meta-v1",
    tagline: "AI-assisted handover generation with Azure retrieval and operator review",
    maturity_stage: "prototype with service-grade controls",
    runtime: {
      mode: "demo",
      config_valid: false,
      allowed_origins_count: 5,
      requests_total: 0,
      errors_total: 0,
      error_rate: 0,
      security_headers_enabled: true,
      auth_controls: [
        "jwt-access-token",
        "refresh-token",
        "csrf-header",
        "route-rate-limit",
      ],
    },
    evidence: {
      test_files: 9,
      deployment_guides: 5,
      ops_artifacts: 4,
      frontend_surfaces: 8,
    },
    platforms: [
      "azure-blob-storage",
      "azure-document-intelligence",
      "azure-ai-search",
      "azure-openai",
      "gemini-preprocess",
      "local-byo-llm",
      "electron",
    ],
    strengths: [
      "The product covers upload, extraction, retrieval, draft generation, and operator review in one workflow.",
      "Azure-native retrieval is paired with a local BYO LLM path so demos can run without cloud spend.",
      "JWT, refresh-token, CSRF rotation, security headers, and runtime diagnostics make the prototype operationally legible.",
      "Interactive editor, print template, and retrieval-backed follow-up chat keep the output grounded in real handover work.",
    ],
    watchouts: [
      "Prototype mode still uses in-memory refresh-token and CSRF stores.",
      "Fine-grained document RBAC at retrieval time is not implemented in this prototype.",
      "Cloud configuration is incomplete, so the full Azure-backed path is not active in static mode.",
    ],
    stages: [
      {
        key: "ingest",
        label: "Ingest and Validation",
        readiness: "ready",
        artifact_count: 4,
        highlights: [
          { label: "Upload router", path: "app/routers/upload.py", kind: "endpoint" },
          { label: "Input validation tests", path: "tests/test_input_validation.py", kind: "test" },
          { label: "Upload authz tests", path: "tests/test_upload_authz.py", kind: "test" },
          { label: "Source sidebar surface", path: "frontend/components/SourceSidebar.tsx", kind: "surface" },
        ],
      },
      {
        key: "structure",
        label: "Structure and Extraction",
        readiness: "ready",
        artifact_count: 4,
        highlights: [
          { label: "Document service", path: "app/services/document_service.py", kind: "endpoint" },
          { label: "Prompt templates", path: "app/services/prompts.py", kind: "endpoint" },
          { label: "Runbook", path: "RUNBOOK.md", kind: "doc" },
          { label: "Handover form", path: "frontend/components/HandoverForm.tsx", kind: "surface" },
        ],
      },
      {
        key: "retrieve",
        label: "Retrieve and Search",
        readiness: "ready",
        artifact_count: 4,
        highlights: [
          { label: "Search service", path: "app/services/search_service.py", kind: "endpoint" },
          { label: "BYO LLM override test", path: "tests/test_llm_override.py", kind: "test" },
          { label: "Assistant service", path: "frontend/services/assistantService.ts", kind: "surface" },
          { label: "Connection guide", path: "CONNECTION_GUIDE.md", kind: "doc" },
        ],
      },
      {
        key: "draft",
        label: "Draft and Collaboration",
        readiness: "ready",
        artifact_count: 4,
        highlights: [
          { label: "Analyze router", path: "app/routers/chat.py", kind: "endpoint" },
          { label: "Chat window", path: "frontend/components/ChatWindow.tsx", kind: "surface" },
          { label: "Print template", path: "frontend/components/HandoverPrintTemplate.tsx", kind: "surface" },
          { label: "Frontend README", path: "frontend/README.md", kind: "doc" },
        ],
      },
      {
        key: "review",
        label: "Operator Review and Runtime",
        readiness: "ready",
        artifact_count: 4,
        highlights: [
          { label: "Ops runtime route", path: "app/routers/ops.py", kind: "endpoint" },
          { label: "Security runtime tests", path: "tests/test_security_runtime.py", kind: "test" },
          { label: "Ops metrics tests", path: "tests/test_ops_metrics.py", kind: "test" },
          { label: "Postmortem template", path: "POSTMORTEM_TEMPLATE.md", kind: "doc" },
        ],
      },
    ],
    review_flow: [
      { order: 1, title: "Login and issue a CSRF-protected session", endpoint: "/api/auth/login", persona: "operator" },
      { order: 2, title: "Upload source documents into the selected index", endpoint: "/api/upload", persona: "operator" },
      { order: 3, title: "Generate the editable handover draft", endpoint: "/api/analyze", persona: "buyer" },
      { order: 4, title: "Ask retrieval-backed follow-up questions", endpoint: "/api/chat", persona: "operator" },
      { order: 5, title: "Inspect runtime diagnostics and security posture", endpoint: "/api/ops/runtime", persona: "security" },
    ],
    links: {
      health: "/api/health",
      meta: "/api/meta",
      handover_schema: "/api/schema/handover",
      ops_metrics: "/api/ops/metrics",
      ops_runtime: "/api/ops/runtime",
      runbook: "RUNBOOK.md",
      deployment_guide: "DEPLOYMENT_GUIDE.md",
      railway_deployment: "RAILWAY_DEPLOYMENT.md",
    },
  };
}

function buildStaticHandoverSchema(): HandoverSchema {
  return {
    schema: "honeypot-handover-v1",
    required_sections: [
      "overview",
      "jobStatus",
      "priorities",
      "stakeholders",
      "teamMembers",
      "ongoingProjects",
      "risks",
      "resources",
      "checklist",
    ],
    required_overview_fields: [
      "transferor.name",
      "transferor.position",
      "transferee.name",
      "transferee.position",
    ],
    delivery_modes: ["interactive-editor", "print-template", "retrieval-backed-chat"],
    operator_rules: [
      "Generated handover drafts require human review before production use.",
      "State-changing endpoints require both JWT and X-CSRF-Token.",
      "Ops runtime surfaces remain admin-only.",
    ],
    links: {
      meta: "/api/meta",
      health: "/api/health",
    },
  };
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [handoverData, setHandoverData] = useState<HandoverData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CHAT);
  const [isProcessing, setIsProcessing] = useState(false);

  // 채팅 세션 관리
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedRagIndex, setSelectedRagIndex] =
    useState<string>("documents-index");
  const [showEngagementHub, setShowEngagementHub] = useState(false);
  const [healthSummary, setHealthSummary] = useState<HealthSummary>(() =>
    buildStaticHealthSummary()
  );
  const [serviceMeta, setServiceMeta] = useState<ServiceMeta>(() =>
    buildStaticServiceMeta()
  );
  const [handoverSchema, setHandoverSchema] = useState<HandoverSchema>(() =>
    buildStaticHandoverSchema()
  );

  // localStorage에서 세션 로드
  useEffect(() => {
    const savedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
    const savedCurrentSession = localStorage.getItem(
      STORAGE_KEY_CURRENT_SESSION
    );

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setChatSessions(parsed);
        console.log("✅ 저장된 채팅 세션 로드됨:", parsed.length, "개");
      } catch (error) {
        console.error("❌ 세션 로드 실패:", error);
      }
    }

    if (savedCurrentSession) {
      setCurrentSessionId(savedCurrentSession);
    }
  }, []);

  // 세션 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(chatSessions));
    console.log("💾 채팅 세션 저장됨:", chatSessions.length, "개");
  }, [chatSessions]);

  // 현재 세션 변경 시 저장
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(STORAGE_KEY_CURRENT_SESSION, currentSessionId);
    }
  }, [currentSessionId]);

  // 세션 선택 시 메시지 로드
  useEffect(() => {
    const selectedSession = chatSessions.find(
      (session) => session.id === currentSessionId
    );
    if (selectedSession) {
      setMessages(selectedSession.messages);
      console.log(
        "📂 세션 로드됨:",
        selectedSession.title,
        "메시지",
        selectedSession.messages.length,
        "개"
      );
    }
  }, [currentSessionId, chatSessions]);

  useEffect(() => {
    if (!isLoggedIn) return;

    // 1분마다 토큰 유효성 체크
    const tokenCheckInterval = setInterval(() => {
      const remainingSeconds = getTokenExpiresIn();

      if (remainingSeconds <= 0) {
        console.log("⚠️ 토큰 만료됨! 자동 로그아웃합니다.");
        removeAllTokens();
        setIsLoggedIn(false);
        alert("세션이 만료되었습니다. 다시 로그인해주세요.");
      } else if (remainingSeconds < 300) {
        // 5분 미만 남음
        console.warn(`⏰ 토큰이 곧 만료됩니다 (${remainingSeconds}초 남음)`);
      }
    }, 60000); // 1분마다 체크

    return () => clearInterval(tokenCheckInterval);
  }, [isLoggedIn]);

  useEffect(() => {
    let cancelled = false;

    async function loadServiceSurfaces() {
      try {
        const healthResponse = await fetchWithTimeout(API_ENDPOINTS.HEALTH, {}, 8000);
        const healthData = await healthResponse.json().catch(() => null);
        if (healthResponse.ok && healthData && !cancelled) {
          setHealthSummary(healthData as HealthSummary);
        }
      } catch (_error) {
        if (!cancelled) {
          setHealthSummary(buildStaticHealthSummary());
        }
      }

      try {
        const metaResponse = await fetchWithTimeout(API_ENDPOINTS.META, {}, 8000);
        const metaData = await metaResponse.json().catch(() => null);
        if (metaResponse.ok && metaData && !cancelled) {
          setServiceMeta(metaData as ServiceMeta);
        }
      } catch (_error) {
        if (!cancelled) {
          setServiceMeta(buildStaticServiceMeta());
        }
      }

      try {
        const schemaResponse = await fetchWithTimeout(API_ENDPOINTS.HANDOVER_SCHEMA, {}, 8000);
        const schemaData = await schemaResponse.json().catch(() => null);
        if (schemaResponse.ok && schemaData && !cancelled) {
          setHandoverSchema(schemaData as HandoverSchema);
        }
      } catch (_error) {
        if (!cancelled) {
          setHandoverSchema(buildStaticHandoverSchema());
        }
      }
    }

    void loadServiceSurfaces();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setViewMode(ViewMode.CHAT_HISTORY);
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setViewMode(ViewMode.CHAT);
  };

  const handleFileUpload = (newFiles: SourceFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileUpdate = (id: string, patch: Partial<SourceFile>) => {
    setFiles((prev) =>
      prev.map((file) => (file.id === id ? { ...file, ...patch } : file))
    );
  };

  const handleFileRemove = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const handleIndexChange = (indexName: string) => {
    setSelectedRagIndex(indexName);
    console.log("✅ App: RAG 인덱스 변경됨:", indexName);
  };

  const updateCurrentSessionMessages = (newMessages: ChatMessage[]) => {
    if (!currentSessionId) return;
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId
          ? { ...session, messages: newMessages, updatedAt: new Date() }
          : session
      )
    );
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = { role: "user", text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsProcessing(true);

    if (!currentSessionId) {
      const newSessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: newSessionId,
        title: text.substring(0, 30) + (text.length > 30 ? "..." : ""),
        messages: updatedMessages,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setChatSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSessionId);
    } else {
      updateCurrentSessionMessages(updatedMessages);
    }

    try {
      const responseText = await chatWithAssistant(
        text,
        files,
        updatedMessages,
        selectedRagIndex
      );
      const aiMsg: ChatMessage = { role: "assistant", text: responseText };
      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      updateCurrentSessionMessages(finalMessages);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        role: "assistant",
        text: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      };
      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);
      updateCurrentSessionMessages(finalMessages);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateHandover = async () => {
    setIsProcessing(true);
    try {
      let filesToAnalyze = files.filter(
        (file) =>
          !file.uploadStatus ||
          file.uploadStatus === "completed" ||
          file.uploadStatus === "completed_with_warning"
      );

      // 업로드된 파일이 없으면 AI Search 인덱스에서 문서 가져오기
      if (files.length > 0 && filesToAnalyze.length === 0) {
        alert("업로드 작업이 아직 진행 중입니다. 상태가 완료된 뒤 다시 시도해주세요.");
        setIsProcessing(false);
        return;
      }

      if (filesToAnalyze.length === 0) {
        console.log(
          "📚 업로드된 파일이 없음 - AI Search 인덱스에서 문서 조회..."
        );
        try {
          const indexName = selectedRagIndex || "documents-index";
          const response = await fetchWithSession(
            `${API_ENDPOINTS.DOCUMENTS}?index_name=${encodeURIComponent(indexName)}`,
            {}
          );
          if (response.ok) {
            const data = await response.json();
            if (data.documents && data.documents.length > 0) {
              console.log(`✅ 인덱스에서 ${data.documents.length}개 문서 조회`);
              // 인덱스 문서들을 SourceFile 형식으로 변환
              filesToAnalyze = data.documents.map((doc: any, idx: number) => ({
                id: doc.id,
                name: doc.file_name,
                type: "text/plain",
                content: doc.content || `[파일: ${doc.file_name}]\n`, // 실제 content 사용!
                mimeType: "text/plain",
              }));
              console.log(
                `📄 변환된 파일 수: ${
                  filesToAnalyze.length
                }, 총 길이: ${filesToAnalyze.reduce(
                  (sum, f) => sum + f.content.length,
                  0
                )}`
              );
            } else {
              alert(
                "업로드된 파일도 없고, AI Search 인덱스에도 문서가 없습니다. 먼저 자료를 추가해주세요!"
              );
              setIsProcessing(false);
              return;
            }
          }
        } catch (error) {
          console.error("❌ 인덱스 조회 실패:", error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          alert(
            `인덱스에서 문서를 가져오는 데 실패했습니다.\n\n` +
            `오류: ${errorMsg}\n\n` +
            `백엔드가 실행 중인지 확인하거나, 자료 보관함에 파일을 직접 추가해주세요.`
          );
          setIsProcessing(false);
          return;
        }
      }

      console.log("📊 인수인계서 분석 시작...", filesToAnalyze);
      const data = await analyzeFilesForHandover(filesToAnalyze, selectedRagIndex || undefined);
      console.log("✅ 분석 완료:", data);
      setHandoverData(data);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "자료 분석을 기반으로 인터랙티브 인수인계서 초안을 완성했습니다! 왼쪽 리포트 영역에서 내용을 확인하고 직접 수정하거나 새로운 항목을 추가할 수 있습니다.",
        },
      ]);
    } catch (error) {
      console.error("❌ 분석 실패:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`인수인계서 생성에 실패했습니다.\n\n오류: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <LoginScreen
        handoverSchema={handoverSchema}
        healthSummary={healthSummary}
        onLogin={() => setIsLoggedIn(true)}
        serviceMeta={serviceMeta}
      />
    );
  }

  return (
    <div id="app-container" className="h-screen bg-[#FFFDF0] text-gray-900 overflow-hidden relative">
      <div className="main-ui flex h-full w-full">
        <div className="honeycomb-bg"></div>

        {/* Sidebar: Storage (Fixed Left) */}
        <SourceSidebar
          files={files}
          onUpload={handleFileUpload}
          onUpdate={handleFileUpdate}
          onRemove={handleFileRemove}
          onIndexChange={handleIndexChange}
        />

        <main className="flex-1 flex gap-8 p-8 overflow-hidden relative z-10">
          {/* Left Side: Handover Interactive Editor (60% Width) */}
          <div className="w-[60%] flex flex-col h-full animate-in fade-in slide-in-from-left-8 duration-1000">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-2.5 h-10 bg-yellow-400 rounded-full"></div>
                <div>
                  <h2 className="text-2xl font-black text-gray-800 tracking-tighter">
                    인수인계 리포트 마스터
                  </h2>
                  <p className="text-[10px] font-black text-yellow-600 uppercase tracking-[0.2em] mt-0.5">
                    Interactive Handover Editor
                  </p>
                </div>
              </div>
              {!handoverData && (
                <button
                  onClick={handleGenerateHandover}
                  disabled={isProcessing}
                  className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-xl hover:bg-black hover:scale-105 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2 group"
                >
                  {isProcessing ? "분석 중..." : "리포트 생성하기"}
                  <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full group-hover:animate-ping"></div>
                </button>
              )}
            </div>
            <HandoverForm data={handoverData} onUpdate={setHandoverData} />
          </div>

          {/* Right Side: AI Assistant & Discussion (40% Width) */}
          <div className="w-[40%] flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
            <div className="mb-3 grid gap-3">
              <LlmApiKeyPanel />
              <ServiceReadinessBoard
                handoverSchema={handoverSchema}
                healthSummary={healthSummary}
                serviceMeta={serviceMeta}
                variant="compact"
              />
              <section className="rounded-2xl border border-gray-300 bg-white/95 p-4 shadow-sm">
                <p className="text-[10px] font-black tracking-[0.16em] text-gray-500 uppercase">
                  Sponsored
                </p>
                <p className="mt-1 text-[11px] text-gray-700 leading-relaxed">
                  Google AdSense 광고 영역
                </p>
                <div className="mt-2">
                  <AdSenseSlot />
                </div>
              </section>
            </div>
            <div className="min-h-0 flex-1">
              <ChatWindow
                messages={messages}
                onSendMessage={handleSendMessage}
                onGenerate={handleGenerateHandover}
                viewMode={viewMode}
                setViewMode={setViewMode}
                isProcessing={isProcessing}
                files={files}
                chatSessions={chatSessions}
                setChatSessions={setChatSessions}
                currentSessionId={currentSessionId}
                setCurrentSessionId={setCurrentSessionId}
                onNewChat={handleNewChat}
                onSelectSession={handleSelectSession}
                selectedRagIndex={selectedRagIndex}
              />
            </div>
          </div>
        </main>
      </div>

      {handoverData && <HandoverPrintTemplate data={handoverData} />}

      <aside className="mx-5 mb-5 max-w-[480px] rounded-2xl border border-gray-300 bg-white/95 shadow-xl p-4">
        <p className="text-[10px] font-black tracking-[0.16em] text-gray-500 uppercase">Trust & Policy</p>
        <p className="mt-1 text-[11px] text-gray-700 leading-relaxed">
          Contact: <a className="underline" href="https://github.com/KIM3310/honeypot/issues">GitHub Issues</a> · Privacy: only handover workflow data needed for this service is retained.
        </p>
        <p className="mt-1 text-[11px] text-gray-700 leading-relaxed">
          Terms: generated handover drafts require human approval before production use.
        </p>
        <p className="mt-1 text-[11px] text-gray-700 leading-relaxed">
          Links: <a className="underline" href="/about.html">About</a> · <a className="underline" href="/privacy.html">Privacy</a> ·{" "}
          <a className="underline" href="/terms.html">Terms</a> ·{" "}
          <a className="underline" href="/contact.html">Contact</a> ·{" "}
          <a className="underline" href="/compliance.html">Compliance</a>
        </p>
      </aside>

      <button
        onClick={() => setShowEngagementHub(true)}
        className="fixed bottom-5 right-5 z-[65] rounded-2xl bg-gray-900 text-white px-4 py-2 text-[11px] font-black tracking-wide shadow-xl hover:bg-black"
      >
        COMMUNITY HUB
      </button>
      <EngagementHub open={showEngagementHub} onClose={() => setShowEngagementHub(false)} />
    </div>
  );
};

export default App;
