/**
 * TempMail Feature Domain Types
 */

export interface TempEmail {
  readonly address: string;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly durationMinutes: number;
}

export interface EmailMessage {
  readonly id: string | number;
  readonly from_address: string;
  readonly subject: string;
  readonly content: string;
  readonly received_at: string;
  is_read?: boolean;
}

export interface TempMailSettings {
  autoFillOnFocus: boolean;
  showFloatingButton: boolean;
  defaultDuration: number;
}

export interface TempMailCurrentState {
  email: TempEmail | null;
  remainingSeconds: number;
  hasValidEmail: boolean;
  unreadCount: number;
}
