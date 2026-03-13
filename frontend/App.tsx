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
  ServiceBrief,
  ServiceMeta,
} from "./types";
import {
  analyzeFilesForHandover,
  chatWithAssistant,
} from "./services/assistantService";
import {
  API_ENDPOINTS,
  API_RUNTIME_CONFIG,
  fetchWithTimeout,
} from "./config/api";
import {
  buildWorkspaceShareUrl,
  buildWorkspaceUrlSearch,
  parseWorkspaceUrlState,
  replaceWorkspaceUrlSearch,
} from "./utils/urlState";
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
      next_action: "Start the backend, then open /api/runtime-brief and /api/ops/runtime to inspect live diagnostics.",
    },
    capabilities: [
      "document-ingest",
      "handover-chat",
      "ops-runtime-observability",
      "security-guardrails",
      "service-metadata-surface",
      "runtime-brief-surface",
    ],
    links: {
      meta: "/api/meta",
      runtime_brief: "/api/runtime-brief",
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
    completeness_gate: {
      schema: "honeypot-handover-completeness-v1",
      score_pct: 0,
      review_ready: false,
      missing_fields: ["owner coverage", "timeline coverage", "risk coverage", "reference coverage"],
      required_checks: ["owner coverage", "timeline coverage", "risk coverage", "reference coverage"],
    },
    two_minute_review: [
      "Open /api/health to confirm runtime mode and next diagnostics step.",
      "Read /api/runtime-brief for trust boundary, review flow, and watchouts.",
      "Inspect /api/schema/handover before trusting draft structure claims.",
      "Open /api/ops/runtime before claiming live Azure-backed readiness.",
    ],
    proof_assets: [
      { label: "Health Route", path: "app/main.py", kind: "endpoint", why: "Confirms the top-level runtime envelope and next operator action." },
      { label: "Runtime Brief Builder", path: "app/service_meta.py", kind: "endpoint", why: "Builds the runtime contract and trust boundary." },
      { label: "Ops Runtime Route", path: "app/routers/ops.py", kind: "endpoint", why: "Provides route-by-route diagnostics before production-readiness claims." },
      { label: "Readiness Board", path: "frontend/components/ServiceReadinessBoard.tsx", kind: "surface", why: "Shows the same posture at login and inside the main workspace." },
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
          { label: "Runbook", path: "docs/ops/RUNBOOK.md", kind: "doc" },
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
          { label: "Connection guide", path: "docs/integration/CONNECTION_GUIDE.md", kind: "doc" },
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
          { label: "Postmortem template", path: "docs/ops/POSTMORTEM_TEMPLATE.md", kind: "doc" },
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
      runtime_brief: "/api/runtime-brief",
      handover_schema: "/api/schema/handover",
      ops_metrics: "/api/ops/metrics",
      ops_runtime: "/api/ops/runtime",
      runbook: "docs/ops/RUNBOOK.md",
      deployment_guide: "docs/deployment/DEPLOYMENT_GUIDE.md",
      railway_deployment: "docs/deployment/RAILWAY_DEPLOYMENT.md",
    },
  };
}

function buildStaticServiceBrief(): ServiceBrief {
  return {
    service: "honeypot",
    status: "ok",
    generated_at: new Date().toISOString(),
    readiness_contract: "honeypot-runtime-brief-v1",
    headline: "Azure-native handover workflow with reviewer-visible controls from login to editable draft.",
    runtime_mode: "demo",
    auth_mode: "jwt-access-token + refresh-token + csrf-header",
    retrieval_mode: "demo retrieval with local BYO LLM override support",
    request_volume: {
      requests_total: 0,
      errors_total: 0,
      error_rate: 0,
    },
    review_pack: {
      required_sections: 9,
      delivery_modes: 3,
      allowed_origins_count: 5,
    },
    report_contract: {
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
      delivery_modes: ["interactive-editor", "print-template", "retrieval-backed-chat"],
    },
    trust_boundary: [
      "ingest: demo parser + docx local support",
      "retrieve: azure-ai-search indexes enterprise handover evidence",
      "generation: demo draft path stays local-first with optional BYO LLM override",
      "override: per-request BYO LLM path stays optional and operator-controlled",
      "review: auth, csrf, ops runtime, and printable handover surface stay explicit",
    ],
    review_flow: [
      "Issue a CSRF-protected session through /api/auth/login.",
      "Upload source materials through /api/upload.",
      "Generate the editable handover draft through /api/analyze.",
      "Use /api/chat for retrieval-backed follow-up questions.",
      "Open /api/ops/runtime for route-by-route diagnostics before production claims.",
    ],
    two_minute_review: [
      "Open /api/health to confirm whether the service is demo or live-configured.",
      "Read /api/runtime-brief for trust boundary, delivery modes, and watchouts.",
      "Inspect /api/schema/handover before trusting the editor contract.",
      "Open /api/ops/runtime before making production-readiness claims.",
    ],
    watchouts: [
      "Prototype mode still uses in-memory refresh-token and CSRF stores.",
      "Fine-grained document RBAC at retrieval time is not implemented in this prototype.",
      "Cloud configuration is incomplete, so the full Azure-backed path is not active in static mode.",
    ],
    completeness_gate: {
      schema: "honeypot-handover-completeness-v1",
      score_pct: 0,
      review_ready: false,
      missing_fields: ["owner coverage", "timeline coverage", "risk coverage", "reference coverage"],
      required_checks: ["owner coverage", "timeline coverage", "risk coverage", "reference coverage"],
    },
    proof_assets: [
      { label: "Health", path: "/api/health", kind: "endpoint", why: "Confirms whether the service is demo or live-configured before a review." },
      { label: "Runtime Brief", path: "/api/runtime-brief", kind: "endpoint", why: "Pins trust boundary, delivery modes, and runtime watchouts in one payload." },
      { label: "Handover Schema", path: "/api/schema/handover", kind: "endpoint", why: "Locks the editor and export contract before trusting draft structure claims." },
      { label: "Ops Runtime", path: "/api/ops/runtime", kind: "endpoint", why: "Shows route-by-route diagnostics before any production-readiness claim." },
    ],
    links: {
      health: "/api/health",
      meta: "/api/meta",
      runtime_brief: "/api/runtime-brief",
      handover_schema: "/api/schema/handover",
      ops_runtime: "/api/ops/runtime",
      ops_metrics: "/api/ops/metrics",
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
      runtime_brief: "/api/runtime-brief",
    },
  };
}

const App: React.FC = () => {
  const initialWorkspaceState =
    typeof window === "undefined"
      ? {}
      : parseWorkspaceUrlState(window.location.search);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [handoverData, setHandoverData] = useState<HandoverData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => initialWorkspaceState.viewMode ?? ViewMode.CHAT
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // 채팅 세션 관리
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => initialWorkspaceState.sessionId ?? null
  );
  const [selectedRagIndex, setSelectedRagIndex] =
    useState<string>(() => initialWorkspaceState.selectedRagIndex ?? "documents-index");
  const [showEngagementHub, setShowEngagementHub] = useState(false);
  const [healthSummary, setHealthSummary] = useState<HealthSummary>(() =>
    buildStaticHealthSummary()
  );
  const [serviceMeta, setServiceMeta] = useState<ServiceMeta>(() =>
    buildStaticServiceMeta()
  );
  const [serviceBrief, setServiceBrief] = useState<ServiceBrief>(() =>
    buildStaticServiceBrief()
  );
  const [handoverSchema, setHandoverSchema] = useState<HandoverSchema>(() =>
    buildStaticHandoverSchema()
  );
  const [backendReachable, setBackendReachable] = useState(false);
  const [apiMisconfigured, setApiMisconfigured] = useState(
    API_RUNTIME_CONFIG.isProductionMisconfigured
  );
  const [runtimeStatusMessage, setRuntimeStatusMessage] = useState(() =>
    API_RUNTIME_CONFIG.isProductionMisconfigured
      ? "지금은 기록된 리뷰 모드입니다. backend 주소를 붙이면 live handover 흐름까지 바로 이어집니다."
      : "백엔드 연결 상태를 확인 중입니다."
  );
  const [workspaceNotice, setWorkspaceNotice] = useState("");

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

    if (!initialWorkspaceState.sessionId && savedCurrentSession) {
      setCurrentSessionId(savedCurrentSession);
    }
  }, [initialWorkspaceState.sessionId]);

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

  useEffect(() => {
    replaceWorkspaceUrlSearch(
      buildWorkspaceUrlSearch({
        viewMode,
        sessionId: currentSessionId ?? undefined,
        selectedRagIndex,
      })
    );
  }, [currentSessionId, selectedRagIndex, viewMode]);

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
    if (!workspaceNotice) return;
    const timer = window.setTimeout(() => setWorkspaceNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [workspaceNotice]);

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
      async function loadSurface<T>(
        url: string,
        fallback: () => T,
        assign: (value: T) => void
      ) {
        try {
          const response = await fetchWithTimeout(url, {}, 8000);
          const data = await response.json().catch(() => null);
          if (response.ok && data && !cancelled) {
            assign(data as T);
            return true;
          }
        } catch (_error) {
          // Fall back to static reviewer surfaces when the backend is unavailable.
        }

        if (!cancelled) {
          assign(fallback());
        }
        return false;
      }

      if (API_RUNTIME_CONFIG.isProductionMisconfigured) {
        if (!cancelled) {
          setHealthSummary(buildStaticHealthSummary());
          setServiceMeta(buildStaticServiceMeta());
          setServiceBrief(buildStaticServiceBrief());
          setHandoverSchema(buildStaticHandoverSchema());
          setBackendReachable(false);
          setApiMisconfigured(true);
          setRuntimeStatusMessage(
            "지금은 기록된 리뷰 모드입니다. live handover 흐름이 필요하면 backend 주소만 연결하면 됩니다."
          );
        }
        return;
      }

      const [healthLive] = await Promise.all([
        loadSurface<HealthSummary>(
          API_ENDPOINTS.HEALTH,
          buildStaticHealthSummary,
          setHealthSummary
        ),
        loadSurface<ServiceMeta>(
          API_ENDPOINTS.META,
          buildStaticServiceMeta,
          setServiceMeta
        ),
        loadSurface<ServiceBrief>(
          API_ENDPOINTS.RUNTIME_BRIEF,
          buildStaticServiceBrief,
          setServiceBrief
        ),
        loadSurface<HandoverSchema>(
          API_ENDPOINTS.HANDOVER_SCHEMA,
          buildStaticHandoverSchema,
          setHandoverSchema
        ),
      ]);

      if (!cancelled) {
        setApiMisconfigured(false);
        setBackendReachable(Boolean(healthLive));
        setRuntimeStatusMessage(
          healthLive
            ? "백엔드가 연결되어 live service surface를 표시 중입니다."
            : "백엔드에 연결할 수 없어 리뷰 전용 정적 surface를 표시 중입니다."
        );
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

  const handleCopyWorkspaceLink = async () => {
    const shareUrl = buildWorkspaceShareUrl(
      buildWorkspaceUrlSearch({
        viewMode,
        sessionId: currentSessionId ?? undefined,
        selectedRagIndex,
      })
    );

    try {
      await navigator.clipboard.writeText(shareUrl);
      setWorkspaceNotice("현재 검토 화면 링크를 복사했습니다.");
    } catch (error) {
      console.error("❌ workspace link 복사 실패:", error);
      setWorkspaceNotice("링크 복사에 실패했습니다.");
    }
  };

  const handleCopyReviewerBundle = async () => {
    const shareUrl = buildWorkspaceShareUrl(
      buildWorkspaceUrlSearch({
        viewMode,
        sessionId: currentSessionId ?? undefined,
        selectedRagIndex,
      })
    );
    const reviewRoutes = Object.values(healthSummary?.links || {}).filter(Boolean);
    const lines = [
      "honeypot reviewer bundle",
      `View: ${viewMode === ViewMode.CHAT ? "chat" : "history"}`,
      `Index: ${selectedRagIndex || "documents-index"}`,
      `Session: ${currentSessionId || "none"}`,
      `Share link: ${shareUrl}`,
      "",
      "Two-minute review",
      ...((serviceMeta?.two_minute_review || []).map((item) => `- ${item}`)),
      "",
      "Fast routes",
      ...(reviewRoutes.length > 0 ? reviewRoutes.map((item) => `- ${item}`) : ["- Runtime links unavailable."]),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setWorkspaceNotice("리뷰어 번들을 복사했습니다.");
    } catch (error) {
      console.error("❌ reviewer bundle 복사 실패:", error);
      setWorkspaceNotice("리뷰어 번들 복사에 실패했습니다.");
    }
  };

  const handleCopyFocusedSession = async () => {
    const lines = [
      "honeypot focused session snapshot",
      `View: ${viewMode === ViewMode.CHAT ? "chat" : "history"}`,
      `Index: ${selectedRagIndex || "documents-index"}`,
      `Session: ${currentSessionId || "none"}`,
      `Messages: ${messages.length}`,
      `Files: ${files.length}`,
      `Runtime: ${healthSummary?.status || "unknown"}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\\n"));
      setWorkspaceNotice("현재 세션 스냅샷을 복사했습니다.");
    } catch (error) {
      console.error("❌ focused session 복사 실패:", error);
      setWorkspaceNotice("세션 스냅샷 복사에 실패했습니다.");
    }
  };

  const handleCopySecuritySnapshot = async () => {
    const reviewRoutes = Object.values(healthSummary?.links || {}).filter(Boolean);
    const lines = [
      "honeypot security posture snapshot",
      `View: ${viewMode === ViewMode.CHAT ? "chat" : "history"}`,
      `Index: ${selectedRagIndex || "documents-index"}`,
      `Session: ${currentSessionId || "none"}`,
      `Runtime: ${healthSummary?.status || "unknown"}`,
      `Mode: ${serviceMeta?.runtime?.mode || "unknown"}`,
      `Config valid: ${serviceMeta?.runtime?.config_valid ? "yes" : "check-required"}`,
      `Allowed origins: ${serviceMeta?.runtime?.allowed_origins_count ?? "unknown"}`,
      `Auth controls: ${(serviceMeta?.runtime?.auth_controls || []).join(", ") || "unknown"}`,
      "",
      "Fast routes",
      ...(reviewRoutes.length > 0 ? reviewRoutes.slice(0, 5).map((item) => `- ${item}`) : ["- Runtime links unavailable."]),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\\n"));
      setWorkspaceNotice("보안 posture 스냅샷을 복사했습니다.");
    } catch (error) {
      console.error("❌ security snapshot 복사 실패:", error);
      setWorkspaceNotice("보안 posture 스냅샷 복사에 실패했습니다.");
    }
  };

  useEffect(() => {
    const handleKeyboardShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = String(target?.tagName || "").toLowerCase();
      const isTypingTarget =
        Boolean(target?.isContentEditable) ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select";
      if (isTypingTarget || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "l") {
        event.preventDefault();
        void handleCopyWorkspaceLink();
        return;
      }
      if (event.shiftKey && key === "b") {
        event.preventDefault();
        void handleCopyReviewerBundle();
        return;
      }
      if (event.shiftKey && key === "s") {
        event.preventDefault();
        void handleCopyFocusedSession();
        return;
      }
      if (event.shiftKey && key === "x") {
        event.preventDefault();
        void handleCopySecuritySnapshot();
        return;
      }
      if (event.shiftKey && key === "n") {
        event.preventDefault();
        handleNewChat();
        return;
      }
      if (key === "?") {
        event.preventDefault();
        setWorkspaceNotice("Shortcuts: 1 chat · 2 history · ⇧L link · ⇧B bundle · ⇧S session snapshot · ⇧X security snapshot · ⇧N new chat");
        return;
      }
      if (event.shiftKey) {
        return;
      }
      if (key === "1") {
        event.preventDefault();
        setViewMode(ViewMode.CHAT);
      } else if (key === "2") {
        event.preventDefault();
        setViewMode(ViewMode.CHAT_HISTORY);
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [
    currentSessionId,
    files.length,
    healthSummary?.links,
    healthSummary?.status,
    messages.length,
    selectedRagIndex,
    handleCopyFocusedSession,
    handleCopySecuritySnapshot,
    serviceMeta?.two_minute_review,
    viewMode,
  ]);

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
        apiMisconfigured={apiMisconfigured}
        backendReachable={backendReachable}
        handoverSchema={handoverSchema}
        healthSummary={healthSummary}
        onLogin={() => setIsLoggedIn(true)}
        runtimeStatusMessage={runtimeStatusMessage}
        serviceBrief={serviceBrief}
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
                serviceBrief={serviceBrief}
                serviceMeta={serviceMeta}
                variant="compact"
              />
              <section className="rounded-2xl border border-gray-300 bg-white/95 p-4 shadow-sm">
                <div className="mb-4 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50/70 p-4">
                    <p className="text-[10px] font-black tracking-[0.16em] text-yellow-700 uppercase">
                      Reviewer handoff story
                    </p>
                    <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-yellow-900">
                      <li>1. 링크로 같은 view / index / session을 재현합니다.</li>
                      <li>2. 리뷰어 번들로 fast routes와 two-minute review를 같이 넘깁니다.</li>
                      <li>3. 세션/보안 스냅샷으로 현재 draft와 reviewer 질문 맥락을 고정합니다.</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                    <p className="text-[10px] font-black tracking-[0.16em] text-gray-500 uppercase">
                      Export posture
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-gray-700">
                      Editor export는 좌측 completeness gate가 열릴 때만 진행됩니다. 여기서는 reviewer에게 현재 상태와 근거 route를 넘기는 것까지만 돕습니다.
                    </p>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.16em] text-gray-500 uppercase">
                      Share Current Review
                    </p>
                    <p className="mt-1 text-[11px] text-gray-700 leading-relaxed">
                      reviewer가 바로 따라올 수 있도록 현재 view, index, selected session을 압축해서 넘깁니다.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={handleCopyWorkspaceLink}
                    className="rounded-xl border border-gray-300 bg-gray-900 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-black"
                  >
                    현재 링크 복사
                  </button>
                  <button
                    onClick={handleCopyReviewerBundle}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-[11px] font-black text-gray-900 shadow-sm hover:bg-gray-50"
                  >
                    리뷰어 번들 복사
                  </button>
                  <button
                    onClick={handleCopyFocusedSession}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-[11px] font-black text-gray-900 shadow-sm hover:bg-gray-50"
                  >
                    세션 스냅샷 복사
                  </button>
                  <button
                    onClick={handleCopySecuritySnapshot}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-[11px] font-black text-gray-900 shadow-sm hover:bg-gray-50"
                  >
                    보안 posture 복사
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-gray-200 bg-yellow-50 px-2 py-1 text-[10px] font-black text-yellow-700">
                    {viewMode === ViewMode.CHAT ? "Chat view" : "History view"}
                  </span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-black text-gray-700">
                    Index: {selectedRagIndex || "documents-index"}
                  </span>
                  {currentSessionId && (
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-black text-gray-700">
                      Session: {currentSessionId.slice(-8)}
                    </span>
                  )}
                </div>
                {workspaceNotice && (
                  <p className="mt-3 text-[11px] font-bold text-yellow-700">{workspaceNotice}</p>
                )}
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">
                  Shortcuts: 1 chat · 2 history · ⇧L link · ⇧B bundle · ⇧S session snapshot · ⇧X security snapshot · ⇧N new chat
                </p>
              </section>
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
