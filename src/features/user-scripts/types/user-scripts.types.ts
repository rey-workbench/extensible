export interface UserScriptMeta {
  name: string;
  namespace: string;
  version: string;
  description: string;
  matches: string[];
  excludes: string[];
  runAt: "document-start" | "document-end" | "document-idle";
  grants: string[];
  requires: string[];
  resources: Record<string, string>;
  injectInto: "page" | "content";
  connects: string[];
  updateURL: string;
  downloadURL: string;
  icon: string;
}

export interface UserScriptRecord {
  id: string;
  code: string;
  meta: UserScriptMeta;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
}

export interface UserScriptRunLogEntry {
  ts: number;
  url: string;
  ok: boolean;
  message?: string;
}

export interface GmHttpRequestDetails {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  responseType?: "text" | "blob" | "arraybuffer" | "json";
  timeout?: number;
}

export interface GmHttpResponse {
  status: number;
  statusText: string;
  responseHeaders: string;
  finalUrl: string;
  data: string;
  isBase64: boolean;
}

export interface GmRpcPayload {
  scriptId: string;
  fn: string;
  args: unknown[];
  token?: string;
}
