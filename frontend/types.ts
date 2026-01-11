export interface SourceFile {
  id: string;
  name: string;
  type: string;
  content: string; // base64
  mimeType: string;
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
