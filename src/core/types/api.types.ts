/**
 * Core IPC messaging envelopes and response contracts.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
