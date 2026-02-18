export type LlmConnectionSettings = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

const STORAGE_KEY = "honeypot_llm_connection_v1";
const DEFAULT_MODEL = "gpt-4o-mini";

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function toStored(settings: Partial<LlmConnectionSettings>): LlmConnectionSettings {
  return {
    apiKey: normalize(settings.apiKey),
    model: normalize(settings.model) || DEFAULT_MODEL,
    baseUrl: normalize(settings.baseUrl),
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

export function getLlmHeaders(): Record<string, string> {
  const settings = getLlmSettings();
  if (!settings.apiKey) {
    return {};
  }

  return {
    "X-LLM-Api-Key": settings.apiKey,
    "X-LLM-Model": settings.model || DEFAULT_MODEL,
    ...(settings.baseUrl ? { "X-LLM-Base-URL": settings.baseUrl } : {}),
  };
}
