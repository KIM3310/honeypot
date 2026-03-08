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

const ServiceReadinessBoard: React.FC<Props> = ({
  handoverSchema,
  healthSummary,
  serviceBrief,
  serviceMeta,
  variant = "full",
}) => {
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
            next action
          </p>
          <p className="mt-1 text-xs text-gray-700">{healthSummary.diagnostics.next_action}</p>
        </div>
      </div>
    </section>
  );
};

export default ServiceReadinessBoard;
