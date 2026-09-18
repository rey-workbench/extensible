export interface TempEmail {
  address: string;
  expiresAt: string;
  createdAt: string;
  durationMinutes: number;
}

export interface EmailMessage {
  id: string | number;
  from_address: string;
  subject: string;
  content: string;
  received_at: string;
  is_read?: boolean;
}

export interface TempMailSettings {
  showFloatingButton: boolean;
}

export type ProviderErrorKind =
  | "rate-limit"
  | "blocked"
  | "server"
  | "timeout"
  | "offline"
  | "not-found"
  | "bad-response"
  | "unknown";

export interface RetryNotice {
  until: number;
  kind: ProviderErrorKind;
  attempts: number;
  message: string;
}

export interface TempMailCurrentState {
  email: TempEmail | null;
  remainingSeconds: number;
  hasValidEmail: boolean;
  unreadCount: number;
  retry: RetryNotice | null;
}

export interface InboxState {
  emails: EmailMessage[];
  remainingSeconds: number;
  retry: RetryNotice | null;
}
