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

export interface InboxState {
  emails: EmailMessage[];
  remainingSeconds: number;
}
