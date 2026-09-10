/** Parsed `// ==UserScript==` header metadata. */
export interface UserScriptMeta {
  name: string;
  namespace: string;
  version: string;
  description: string;
  /** Include patterns: glob match patterns or /regex/ literals. */
  matches: string[];
  /** Exclude patterns, same syntax as `matches`. */
  excludes: string[];
  runAt: "document-start" | "document-end" | "document-idle";
  /** Requested GM_* grants (SEC-04: APIs are injected only when granted). */
  grants: string[];
  /** External libraries fetched and prepended before the script body. */
  requires: string[];
  /** Named resources `@resource <name> <url>`. */
  resources: Record<string, string>;
  /** Injection context: `page` = MAIN world, `content` = ISOLATED world. */
  injectInto: "page" | "content";
  /** Domains whitelisted for GM_xmlhttpRequest. */
  connects: string[];
  updateURL: string;
  downloadURL: string;
  icon: string;
}

/** A stored userscript. Array order in storage = execution priority (SM-08). */
export interface UserScriptRecord {
  id: string;
  code: string;
  meta: UserScriptMeta;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
}

/** One execution attempt of a script (UI-04 run log). */
export interface UserScriptRunLogEntry {
  ts: number;
  url: string;
  ok: boolean;
  message?: string;
}

/** Serializable subset of a GM_xmlhttpRequest details object. */
export interface GmHttpRequestDetails {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  responseType?: "text" | "blob" | "arraybuffer" | "json";
  timeout?: number;
}

/** Result returned by the background fetch for GM_xmlhttpRequest. */
export interface GmHttpResponse {
  status: number;
  statusText: string;
  responseHeaders: string;
  finalUrl: string;
  /** Decoded body: text for text/json, base64 for blob/arraybuffer. */
  data: string;
  isBase64: boolean;
}

/** Payload relayed through the RPC bridge (ARC-02). */
export interface GmRpcPayload {
  scriptId: string;
  fn: string;
  args: unknown[];
}
