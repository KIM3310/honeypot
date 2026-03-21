import { ViewMode } from "../types";

export interface WorkspaceUrlState {
  sessionId?: string;
  selectedRagIndex?: string;
  viewMode?: ViewMode;
}

function normalizeSearch(search: string) {
  return search.startsWith("?") ? search.slice(1) : search;
}

function sanitizeValue(value: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseWorkspaceUrlState(search: string): WorkspaceUrlState {
  const params = new URLSearchParams(normalizeSearch(search));
  const next: WorkspaceUrlState = {};
  const view = params.get("view");
  const session = sanitizeValue(params.get("session"));
  const index = sanitizeValue(params.get("index"));

  if (view === ViewMode.CHAT || view === ViewMode.CHAT_HISTORY) {
    next.viewMode = view;
  }
  if (session) {
    next.sessionId = session;
  }
  if (index) {
    next.selectedRagIndex = index;
  }

  return next;
}

export function buildWorkspaceUrlSearch(state: WorkspaceUrlState) {
  const params = new URLSearchParams();
  if (state.viewMode && state.viewMode !== ViewMode.CHAT) params.set("view", state.viewMode);
  if (state.sessionId) params.set("session", state.sessionId);
  if (state.selectedRagIndex && state.selectedRagIndex !== "documents-index") {
    params.set("index", state.selectedRagIndex);
  }
  return params.toString();
}

export function replaceWorkspaceUrlSearch(nextSearch: string) {
  if (typeof window === "undefined") return;
  const search = nextSearch ? `?${nextSearch}` : "";
  const nextUrl = `${window.location.pathname}${search}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

export function buildWorkspaceShareUrl(
  nextSearch: string,
  options?: {
    origin?: string;
    pathname?: string;
    hash?: string;
  },
) {
  const origin = options?.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const pathname = options?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const hash = options?.hash ?? (typeof window !== "undefined" ? window.location.hash : "");
  const search = nextSearch ? `?${nextSearch}` : "";
  return `${origin}${pathname}${search}${hash}`;
}
