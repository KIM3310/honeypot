export interface SourceFile {
  id: string;
  name: string;
  type: string;
  content: string; // base64
  mimeType: string;
  uploadTaskId?: string;
  uploadStatus?: "pending" | "processing" | "completed" | "completed_with_warning" | "failed";
  uploadProgress?: number;
  uploadMessage?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface HandoverData {
  overview: {
    transferor: { name: string; position: string; contact: string };
    transferee: {
      name: string;
      position: string;
      contact: string;
      startDate?: string;
    };
    reason?: string;
    background?: string;
    period?: string;
  };
  jobStatus: {
    title: string;
    responsibilities: string[];
    authority?: string;
    reportingLine?: string;
    teamMission?: string;
    teamGoals?: string[];
  };
  priorities: {
    title: string;
    status: string;
    deadline?: string;
  }[];
  stakeholders: {
    manager?: string;
    internal: { name: string; role: string; contact?: string }[];
  };
  teamMembers: {
    name: string;
    position: string;
    role: string;
    notes?: string;
  }[];
  ongoingProjects: {
    name: string;
    owner: string;
    status: string;
    progress: number;
    deadline: string;
    description: string;
  }[];
  risks: {
    issues: string;
    risks: string;
  };
  resources: {
    docs: { category: string; name: string; location: string }[];
    systems: { name: string; usage: string; contact: string }[];
  };
  checklist: { text: string; completed: boolean }[];
}

export enum ViewMode {
  CHAT = "CHAT",
  CHAT_HISTORY = "CHAT_HISTORY",
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceArtifact {
  label: string;
  path: string;
  kind: "doc" | "test" | "endpoint" | "surface";
}

export interface ServiceStage {
  key: "ingest" | "structure" | "retrieve" | "draft" | "review";
  label: string;
  readiness: "ready" | "in_progress" | "attention";
  artifact_count: number;
  highlights: ServiceArtifact[];
}

export interface ServiceMeta {
  service: string;
  contract_version: string;
  tagline: string;
  maturity_stage: string;
  runtime: {
    mode: string;
    config_valid: boolean;
    allowed_origins_count: number;
    requests_total: number;
    errors_total: number;
    error_rate: number;
    security_headers_enabled: boolean;
    auth_controls: string[];
  };
  evidence: {
    test_files: number;
    deployment_guides: number;
    ops_artifacts: number;
    frontend_surfaces: number;
  };
  platforms: string[];
  strengths: string[];
  watchouts: string[];
  stages: ServiceStage[];
  review_flow: {
    order: number;
    title: string;
    endpoint: string;
    persona: string;
  }[];
  links: Record<string, string>;
}

export interface HandoverSchema {
  schema: string;
  required_sections: string[];
  required_overview_fields: string[];
  delivery_modes: string[];
  operator_rules: string[];
  links: Record<string, string>;
}

export interface HealthSummary {
  status: string;
  service: string;
  mode: string;
  config_valid: boolean;
  allowed_origins_count: number;
  requests_total: number;
  errors_total: number;
  error_rate: number;
  request_id?: string | null;
  diagnostics: {
    runtime_mode: string;
    next_action: string;
  };
  capabilities: string[];
  links: Record<string, string>;
}
