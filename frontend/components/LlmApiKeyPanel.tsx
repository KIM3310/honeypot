import React, { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Save, Trash2 } from "lucide-react";
import {
  clearLlmSettings,
  getLlmSettings,
  saveLlmSettings,
} from "../utils/llmConfig";

const LlmApiKeyPanel: React.FC = () => {
  const initial = useMemo(() => getLlmSettings(), []);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [showKey, setShowKey] = useState(false);
  const [statusText, setStatusText] = useState(
    initial.apiKey ? "개인 API 키가 연결되어 있습니다." : "서버 기본 키 모드입니다."
  );

  const isConnected = apiKey.trim().length > 0;

  const handleSave = () => {
    const saved = saveLlmSettings({ apiKey, model, baseUrl });
    setApiKey(saved.apiKey);
    setModel(saved.model);
    setBaseUrl(saved.baseUrl);
    setStatusText(saved.apiKey ? "저장 완료: 개인 API 키로 호출됩니다." : "입력된 키가 없어 서버 기본 키로 동작합니다.");
  };

  const handleClear = () => {
    clearLlmSettings();
    setApiKey("");
    setModel("gpt-4o-mini");
    setBaseUrl("");
    setStatusText("개인 키 연결이 해제되었습니다. 서버 기본 키 모드로 전환됩니다.");
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100">
            <KeyRound className="h-4 w-4 text-yellow-700" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">BYO LLM</p>
            <h3 className="text-sm font-extrabold text-gray-800">내 API 키 연결</h3>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-black ${
            isConnected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {isConnected ? "CONNECTED" : "DEFAULT"}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-gray-600">
        키는 이 브라우저의 <code>localStorage</code>에만 저장됩니다. 서버 DB에는 저장하지 않습니다.
      </p>

      <div className="mt-3 space-y-2">
        <label className="block text-[11px] font-bold text-gray-600">
          API Key
          <div className="mt-1 flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... 또는 OpenAI 호환 키"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-yellow-400"
            />
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              className="rounded-xl border border-gray-200 px-2 text-gray-600 hover:bg-gray-50"
              aria-label="API key visibility"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <label className="block text-[11px] font-bold text-gray-600">
          Model
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-yellow-400"
          />
        </label>

        <label className="block text-[11px] font-bold text-gray-600">
          Base URL (선택)
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-yellow-400"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-[11px] font-black text-white hover:bg-black"
        >
          <Save className="h-3.5 w-3.5" />
          저장
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black text-gray-700 hover:bg-gray-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          해제
        </button>
      </div>

      <p className="mt-2 text-[11px] text-gray-600">{statusText}</p>
    </section>
  );
};

export default LlmApiKeyPanel;
