export type LlmConnectionSettings = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

const STORAGE_KEY = "honeypot_llm_connection_v1";
export const DEFAULT_MODEL = "gpt-4o-mini";
export const OLLAMA_DEFAULT_MODEL = "llama3.2:latest";
export const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function isLikelyLocalHost(rawHost: string): boolean {
  const host = rawHost.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "host.docker.internal") return true;
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  return host.endsWith(".local");
}

function normalizeBaseUrl(value: unknown): string {
  let raw = normalize(value);
  if (!raw) return "";

  if (!/^https?:\/\//i.test(raw)) {
    const hostPort = raw.split("/", 1)[0];
    const host = hostPort.split(":", 1)[0];
    const scheme = isLikelyLocalHost(host) ? "http" : "https";
    raw = `${scheme}://${raw}`;
  }

  return raw.replace(/\/+$/, "");
}

function toStored(settings: Partial<LlmConnectionSettings>): LlmConnectionSettings {
  return {
    apiKey: normalize(settings.apiKey),
    model: normalize(settings.model) || DEFAULT_MODEL,
    baseUrl: normalizeBaseUrl(settings.baseUrl),
  };
}

export function getLlmSettings(): LlmConnectionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return toStored({});
    }
    return toStored(JSON.parse(raw));
  } catch {
    return toStored({});
  }
}

export function saveLlmSettings(settings: Partial<LlmConnectionSettings>): LlmConnectionSettings {
  const normalized = toStored(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearLlmSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isLlmSettingsActive(settings: LlmConnectionSettings = getLlmSettings()): boolean {
  return Boolean(settings.apiKey || settings.baseUrl);
}

export function buildOllamaPreset(): LlmConnectionSettings {
  return toStored({
    apiKey: "",
    model: OLLAMA_DEFAULT_MODEL,
    baseUrl: OLLAMA_DEFAULT_BASE_URL,
  });
}

export function getLlmHeaders(): Record<string, string> {
  const settings = getLlmSettings();
  if (!isLlmSettingsActive(settings)) {
    return {};
  }

  const headers: Record<string, string> = {};
  if (settings.apiKey) {
    headers["X-LLM-Api-Key"] = settings.apiKey;
  }
  headers["X-LLM-Model"] = settings.model || DEFAULT_MODEL;
  if (settings.baseUrl) {
    headers["X-LLM-Base-URL"] = settings.baseUrl;
  }
  return headers;
}
