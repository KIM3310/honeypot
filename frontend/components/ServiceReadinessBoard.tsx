import React from "react";
import { HandoverSchema, HealthSummary, ServiceBrief, ServiceMeta } from "../types";

interface Props {
  handoverSchema: HandoverSchema | null;
  healthSummary: HealthSummary | null;
  serviceBrief?: ServiceBrief | null;
  serviceMeta: ServiceMeta | null;
  variant?: "full" | "compact";
}

function readinessTone(readiness: string): string {
  switch (String(readiness || "").toLowerCase()) {
    case "ready":
      return "bg-green-100 text-green-700 border border-green-200";
    case "in_progress":
      return "bg-amber-100 text-amber-700 border border-amber-200";
    default:
      return "bg-red-100 text-red-700 border border-red-200";
  }
}

function healthTone(status: string): string {
  switch (String(status || "").toLowerCase()) {
    case "ok":
      return "bg-green-100 text-green-700 border border-green-200";
    case "degraded":
      return "bg-amber-100 text-amber-700 border border-amber-200";
    default:
      return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  const payload = String(text || "").trim();
  if (!payload) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      return true;
    }
  } catch {
    // Fallback below.
  }

  try {
    const helper = document.createElement("textarea");
    helper.value = payload;
    helper.setAttribute("readonly", "true");
    helper.style.position = "absolute";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    const ok = document.execCommand("copy");
    helper.remove();
    return Boolean(ok);
  } catch {
    return false;
  }
}

const ServiceReadinessBoard: React.FC<Props> = ({
  handoverSchema,
  healthSummary,
  serviceBrief,
  serviceMeta,
  variant = "full",
}) => {
  const [copyStatus, setCopyStatus] = React.useState("");

  if (!serviceMeta || !handoverSchema || !healthSummary) {
    return null;
  }

  const compact = variant === "compact";
  const visibleStages = compact ? serviceMeta.stages.slice(0, 3) : serviceMeta.stages;
  const visibleWatchouts = compact
    ? (serviceBrief?.watchouts ?? serviceMeta.watchouts).slice(0, 2)
    : serviceBrief?.watchouts ?? serviceMeta.watchouts;
  const reviewSteps = compact
    ? (serviceBrief?.review_flow ?? serviceMeta.review_flow.map((step) => step.title)).slice(0, 3)
    : serviceBrief?.review_flow ?? serviceMeta.review_flow.map((step) => step.title);
  const twoMinuteReview = compact
    ? (serviceBrief?.two_minute_review ?? serviceMeta.two_minute_review).slice(0, 3)
    : serviceBrief?.two_minute_review ?? serviceMeta.two_minute_review;
  const proofAssets = compact
    ? (serviceBrief?.proof_assets ?? serviceMeta.proof_assets).slice(0, 3)
    : serviceBrief?.proof_assets ?? serviceMeta.proof_assets;
  const reviewLinks = Array.from(
    new Map(
      [
        ...(serviceBrief ? Object.entries(serviceBrief.links || {}) : []),
        ...Object.entries(serviceMeta.links || {}),
        ...Object.entries(handoverSchema.links || {}),
      ].filter(([, path]) => typeof path === "string" && path)
    ).entries()
  ).slice(0, compact ? 4 : 6);
  const reviewLinkHints: Record<string, string> = {
    health: "Confirm runtime mode and the next operator action before the walkthrough.",
    meta: "Open the service contract and evidence posture in one payload.",
    runtime_brief: "Read trust boundary, delivery modes, and watchouts before claiming readiness.",
    handover_schema: "Lock the editor and export contract before trusting generated drafts.",
    ops_metrics: "Check runtime volume and error posture from the reviewer path.",
    ops_runtime: "Inspect route-by-route diagnostics before any production-readiness claim.",
    runbook: "Tie runtime evidence back to operator playbooks.",
    deployment_guide: "Show the deployment path that follows the demo surface.",
    railway_deployment: "Keep hosted demo setup legible without leaving the repo context.",
  };
  const reviewRouteText = [
    "Honeypot reviewer routes",
    ...reviewLinks.map(([label, path]) => `- ${label}: ${path}`),
  ].join("\n");
  const twoMinuteReviewText = [
    "Honeypot 2-minute review",
    ...twoMinuteReview.map((step) => `- ${step}`),
  ].join("\n");
  const proofBundleText = [
    "Honeypot proof bundle",
    ...reviewLinks.map(([label, path]) => `- ${label}: ${path}`),
    ...(proofAssets.length ? ["", "Proof assets", ...proofAssets.map((asset) => `- ${asset}`)] : []),
  ].join("\n");
  const deliveryBoundaryText = [
    "Honeypot delivery boundary",
    `Health: ${healthSummary.status}`,
    `Runtime mode: ${serviceMeta.runtime.mode}`,
    `Runtime config: ${serviceMeta.runtime.config_valid ? "valid" : "check-required"}`,
    `Required sections: ${handoverSchema.required_sections.length}`,
    `Allowed origins: ${serviceMeta.runtime.allowed_origins_count}`,
    ...(serviceBrief
      ? [
          `Delivery modes: ${serviceBrief.review_pack.delivery_modes}`,
          `Review sections: ${serviceBrief.review_pack.required_sections}`,
        ]
      : []),
    "",
    "Boundary routes",
    ...reviewLinks.slice(0, 4).map(([label, path]) => `- ${label}: ${path}`),
  ].join("\n");
  const azureClaimText = [
    "Honeypot Azure claim snapshot",
    `Headline: ${serviceBrief?.headline ?? serviceMeta.tagline}`,
    `Health: ${healthSummary.status}`,
    `Runtime mode: ${serviceMeta.runtime.mode}`,
    `Runtime config: ${serviceMeta.runtime.config_valid ? "valid" : "check-required"}`,
    `Allowed origins: ${serviceMeta.runtime.allowed_origins_count}`,
    ...(serviceBrief
      ? [
          `Delivery modes: ${serviceBrief.review_pack.delivery_modes}`,
          `Review sections: ${serviceBrief.review_pack.required_sections}`,
        ]
      : []),
    "",
    "Fast routes",
    ...reviewLinks.slice(0, 4).map(([label, path]) => `- ${label}: ${path}`),
  ].join("\n");

  const handleCopyRoutes = async () => {
    const ok = await copyTextToClipboard(reviewRouteText);
    setCopyStatus(ok ? "Copied reviewer routes." : "Failed to copy reviewer routes.");
  };

  const handleCopyTwoMinuteReview = async () => {
    const ok = await copyTextToClipboard(twoMinuteReviewText);
    setCopyStatus(ok ? "Copied 2-minute review." : "Failed to copy 2-minute review.");
  };

  const handleCopyProofBundle = async () => {
    const ok = await copyTextToClipboard(proofBundleText);
    setCopyStatus(ok ? "Copied proof bundle." : "Failed to copy proof bundle.");
  };

  const handleCopyDeliveryBoundary = async () => {
    const ok = await copyTextToClipboard(deliveryBoundaryText);
    setCopyStatus(ok ? "Copied delivery boundary." : "Failed to copy delivery boundary.");
  };

  const handleCopyAzureClaim = async () => {
    const ok = await copyTextToClipboard(azureClaimText);
    setCopyStatus(ok ? "Copied Azure claim snapshot." : "Failed to copy Azure claim snapshot.");
  };

  return (
    <section className="rounded-[2rem] border border-yellow-200 bg-white/95 shadow-[0_20px_40px_-20px_rgba(15,23,42,0.28)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black tracking-[0.18em] text-yellow-600 uppercase">
            Service Brief
          </p>
          <h3 className="mt-1 text-lg font-black text-gray-900 tracking-tight">
            {serviceBrief ? "Runtime Contract and Review Pack" : "Enterprise Handover Readiness"}
          </h3>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            {serviceBrief?.headline ?? serviceMeta.tagline}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${healthTone(healthSummary.status)}`}>
            health {healthSummary.status}
          </span>
          <span className="rounded-full bg-gray-900 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            mode {serviceMeta.runtime.mode}
          </span>
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-yellow-700 border border-yellow-200">
            schema {handoverSchema.required_sections.length} sections
          </span>
        </div>
      </div>

      {serviceBrief ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
              Runtime Contract
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600 border border-gray-200">
                {serviceBrief.readiness_contract}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600 border border-gray-200">
                {serviceBrief.report_contract.schema}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600 border border-gray-200">
                {serviceBrief.runtime_mode}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <article className="rounded-2xl bg-white p-3 border border-gray-200">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Auth</p>
                <strong className="mt-1 block text-sm font-black text-gray-900">
                  CSRF + JWT
                </strong>
                <p className="mt-1 text-[11px] text-gray-600">{serviceBrief.auth_mode}</p>
              </article>
              <article className="rounded-2xl bg-white p-3 border border-gray-200">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Retrieve</p>
                <strong className="mt-1 block text-sm font-black text-gray-900">
                  Handover RAG
                </strong>
                <p className="mt-1 text-[11px] text-gray-600">{serviceBrief.retrieval_mode}</p>
              </article>
              <article className="rounded-2xl bg-white p-3 border border-gray-200">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Review Pack</p>
                <strong className="mt-1 block text-sm font-black text-gray-900">
                  {serviceBrief.review_pack.required_sections} sections
                </strong>
                <p className="mt-1 text-[11px] text-gray-600">
                  {serviceBrief.review_pack.delivery_modes} delivery modes
                </p>
              </article>
              <article className="rounded-2xl bg-white p-3 border border-gray-200">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Origins</p>
                <strong className="mt-1 block text-sm font-black text-gray-900">
                  {serviceBrief.review_pack.allowed_origins_count}
                </strong>
                <p className="mt-1 text-[11px] text-gray-600">frontend allowlist entries</p>
              </article>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Review Pack</p>
            <ul className="mt-2 space-y-2 text-xs text-gray-700">
              {reviewSteps.map((step) => (
                <li key={step}>• {step}</li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
              Quick Review
            </p>
            <ul className="mt-2 space-y-2 text-xs text-gray-700">
              {twoMinuteReview.map((step) => (
                <li key={step}>• {step}</li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
              Trust Boundary
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {serviceBrief.trust_boundary.slice(0, compact ? 3 : 5).map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600 border border-gray-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="rounded-2xl bg-yellow-50 p-3 border border-yellow-100">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-700">Tests</p>
          <strong className="mt-1 block text-2xl font-black text-gray-900">
            {serviceMeta.evidence.test_files}
          </strong>
        </article>
        <article className="rounded-2xl bg-yellow-50 p-3 border border-yellow-100">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-700">Deploy Docs</p>
          <strong className="mt-1 block text-2xl font-black text-gray-900">
            {serviceMeta.evidence.deployment_guides}
          </strong>
        </article>
        <article className="rounded-2xl bg-yellow-50 p-3 border border-yellow-100">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-700">Requests</p>
          <strong className="mt-1 block text-2xl font-black text-gray-900">
            {healthSummary.requests_total}
          </strong>
        </article>
        <article className="rounded-2xl bg-yellow-50 p-3 border border-yellow-100">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-700">Origins</p>
          <strong className="mt-1 block text-2xl font-black text-gray-900">
            {serviceMeta.runtime.allowed_origins_count}
          </strong>
        </article>
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Reviewer Fast Path</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyRoutes()}
            className="rounded-full border border-gray-200 bg-gray-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white"
          >
            Copy Review Routes
          </button>
          <button
            type="button"
            onClick={() => void handleCopyTwoMinuteReview()}
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-700"
          >
            Copy Quick Review
          </button>
          <button
            type="button"
            onClick={() => void handleCopyProofBundle()}
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-700"
          >
            Copy Proof Bundle
          </button>
          <button
            type="button"
            onClick={() => void handleCopyDeliveryBoundary()}
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-700"
          >
            Copy Delivery Boundary
          </button>
          <button
            type="button"
            onClick={() => void handleCopyAzureClaim()}
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-700"
          >
            Copy Azure Claim
          </button>
          {copyStatus ? <span className="text-[11px] text-gray-500">{copyStatus}</span> : null}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reviewLinks.map(([label, path]) => (
            <article key={`${label}-${path}`} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">{label.replaceAll("_", " ")}</p>
              <code className="mt-2 block rounded-xl bg-white px-2 py-1 text-[10px] text-gray-600 border border-gray-200">
                {path}
              </code>
              <p className="mt-2 text-[11px] text-gray-600">
                {reviewLinkHints[label] ?? "Reviewer-visible route or document for the handover walkthrough."}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Trust Boundary</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {serviceMeta.platforms.map((platform) => (
              <span
                key={platform}
                className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600 border border-gray-200"
              >
                {platform}
              </span>
            ))}
          </div>
          <ul className="mt-3 space-y-2 text-xs text-gray-700">
            {serviceMeta.strengths.slice(0, compact ? 2 : 4).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Operator Rules</p>
          <ul className="mt-2 space-y-2 text-xs text-gray-700">
            {handoverSchema.operator_rules.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleStages.map((stage) => (
          <article key={stage.key} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-gray-900">{stage.label}</p>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${readinessTone(stage.readiness)}`}>
                {stage.readiness.replace("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-bold text-gray-500 uppercase tracking-[0.16em]">
              {stage.artifact_count} proof points
            </p>
            <ul className="mt-3 space-y-2 text-xs text-gray-700">
              {stage.highlights.slice(0, compact ? 2 : 4).map((artifact) => (
                <li key={`${stage.key}-${artifact.path}`}>
                  <span className="font-semibold">{artifact.label}</span>
                  <code className="mt-1 block rounded-xl bg-gray-100 px-2 py-1 text-[10px] text-gray-600">
                    {artifact.path}
                  </code>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Review Flow</p>
          <ol className="mt-2 space-y-2 text-xs text-gray-700">
            {serviceBrief
              ? reviewSteps.map((step, index) => (
                  <li key={step}>
                    <span className="font-black text-gray-900">{String(index + 1).padStart(2, "0")}</span>
                    {" "} {step}
                  </li>
                ))
              : serviceMeta.review_flow.slice(0, compact ? 3 : 5).map((step) => (
                  <li key={`${step.order}-${step.endpoint}`}>
                    <span className="font-black text-gray-900">{String(step.order).padStart(2, "0")}</span>
                    {" "} {step.title}
                    <code className="mt-1 block rounded-xl bg-gray-100 px-2 py-1 text-[10px] text-gray-600">
                      {step.endpoint}
                    </code>
                  </li>
                ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Watchouts</p>
          <ul className="mt-2 space-y-2 text-xs text-gray-700">
            {visibleWatchouts.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
            Proof Assets
          </p>
          <ul className="mt-2 space-y-2 text-xs text-gray-700">
            {proofAssets.map((asset) => (
              <li key={`${asset.kind}-${asset.path}`}>
                <span className="font-semibold">{asset.label}</span>
                <code className="mt-1 block rounded-xl bg-gray-100 px-2 py-1 text-[10px] text-gray-600">
                  {asset.path}
                </code>
                {asset.why ? (
                  <p className="mt-1 text-[11px] text-gray-500">{asset.why}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
            next action
          </p>
          <p className="mt-1 text-xs text-gray-700">{healthSummary.diagnostics.next_action}</p>
        </div>
      </div>
    </section>
  );
};

export default ServiceReadinessBoard;
