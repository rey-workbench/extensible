/**
 * TempMail Feature Domain Types (plain TS interfaces — WXT storage handles persistence).
 */

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

export interface TempMailCurrentState {
  email: TempEmail | null;
  remainingSeconds: number;
  hasValidEmail: boolean;
  unreadCount: number;
}

/** GET_INBOX response: cached inbox + remaining countdown for the popup. */
export interface InboxState {
  emails: EmailMessage[];
  remainingSeconds: number;
}
