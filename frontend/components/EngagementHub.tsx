import React, { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const FORMSPREE_ENDPOINT = String(import.meta.env.VITE_FORMSPREE_ENDPOINT || "").trim();
const DISQUS_SHORTNAME = String(import.meta.env.VITE_DISQUS_SHORTNAME || "").trim();
const DISQUS_IDENTIFIER = String(import.meta.env.VITE_DISQUS_IDENTIFIER || "honeypot-hub").trim();
const GISCUS_REPO = String(import.meta.env.VITE_GISCUS_REPO || "").trim();
const GISCUS_REPO_ID = String(import.meta.env.VITE_GISCUS_REPO_ID || "").trim();
const GISCUS_CATEGORY = String(import.meta.env.VITE_GISCUS_CATEGORY || "").trim();
const GISCUS_CATEGORY_ID = String(import.meta.env.VITE_GISCUS_CATEGORY_ID || "").trim();

const EngagementHub: React.FC<Props> = ({ open, onClose }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [notice, setNotice] = useState("");
  const giscusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !DISQUS_SHORTNAME || typeof document === "undefined") {
      return;
    }
    if (document.getElementById("honeypot-disqus-script")) {
      return;
    }
    const script = document.createElement("script");
    script.id = "honeypot-disqus-script";
    script.src = `https://${DISQUS_SHORTNAME}.disqus.com/embed.js`;
    script.async = true;
    script.setAttribute("data-timestamp", String(Date.now()));
    script.setAttribute("data-identifier", DISQUS_IDENTIFIER);
    document.body.appendChild(script);
  }, [open]);

  useEffect(() => {
    if (
      !open ||
      !giscusRef.current ||
      !GISCUS_REPO ||
      !GISCUS_REPO_ID ||
      !GISCUS_CATEGORY ||
      !GISCUS_CATEGORY_ID
    ) {
      return;
    }
    if (giscusRef.current.querySelector("script[data-giscus]")) {
      return;
    }
    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.setAttribute("data-giscus", "1");
    script.setAttribute("data-repo", GISCUS_REPO);
    script.setAttribute("data-repo-id", GISCUS_REPO_ID);
    script.setAttribute("data-category", GISCUS_CATEGORY);
    script.setAttribute("data-category-id", GISCUS_CATEGORY_ID);
    script.setAttribute("data-mapping", "pathname");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", "light");
    script.setAttribute("data-lang", "ko");
    script.crossOrigin = "anonymous";
    giscusRef.current.appendChild(script);
  }, [open]);

  const submitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!FORMSPREE_ENDPOINT) {
      setStatus("error");
      setNotice("VITE_FORMSPREE_ENDPOINT를 설정하면 피드백 폼을 사용할 수 있습니다.");
      return;
    }
    setStatus("submitting");
    setNotice("");
    try {
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          source: "honeypot",
          page_url: window.location.href,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = String(payload?.errors?.[0]?.message || payload?.error || "요청 실패");
        throw new Error(detail);
      }
      setStatus("success");
      setMessage("");
      setNotice("피드백 전송 완료. 개선 백로그에 반영합니다.");
    } catch (error) {
      setStatus("error");
      setNotice(error instanceof Error ? error.message : "피드백 전송 실패");
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-black tracking-wide text-gray-900">Community & Feedback Hub</h2>
            <p className="text-[11px] text-gray-500">Formspree + Disqus + Giscus(Open Source)</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-black text-gray-700 hover:bg-gray-100"
          >
            CLOSE
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 max-h-[76vh] overflow-y-auto">
          <section className="rounded-xl border border-gray-200 p-4 bg-gray-50">
            <h3 className="text-sm font-black mb-3 text-gray-900">Formspree 피드백</h3>
            <form onSubmit={submitFeedback} className="space-y-2">
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="이름"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="이메일"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
              />
              <textarea
                required
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="서비스에서 개선할 점을 알려주세요."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
              />
              <button
                disabled={status === "submitting"}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                {status === "submitting" ? "전송중..." : "피드백 전송"}
              </button>
            </form>
            {notice && (
              <p className={`mt-2 text-[11px] ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>
                {notice}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-[11px] font-black tracking-wide text-gray-500 mb-2">DISQUS</p>
              {DISQUS_SHORTNAME ? (
                <div id="disqus_thread" className="min-h-24" />
              ) : (
                <p className="text-xs text-gray-500">VITE_DISQUS_SHORTNAME 설정 시 활성화됩니다.</p>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-[11px] font-black tracking-wide text-gray-500 mb-2">GISCUS (OSS)</p>
              {GISCUS_REPO && GISCUS_REPO_ID && GISCUS_CATEGORY && GISCUS_CATEGORY_ID ? (
                <div ref={giscusRef} className="min-h-24" />
              ) : (
                <p className="text-xs text-gray-500">VITE_GISCUS_* 설정 시 활성화됩니다.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EngagementHub;
