import type { TempMailSettings } from "../types/temp-mail.types";

export const DEFAULT_TEMPMAIL_SETTINGS: TempMailSettings = {
  showFloatingButton: true,
};

export const TEMPMAIL_ACTIONS = {
  GET_CURRENT: "temp_mail:get_current",
  GENERATE_NEW: "temp_mail:generate_new",
  GET_INBOX: "temp_mail:get_inbox",
  DELETE_MESSAGE: "temp_mail:delete_message",
  AUTOFILL_ACTIVE_TAB: "temp_mail:autofill_active_tab",
  AUTOFILL_EMAIL: "temp_mail:autofill_email",
  UPDATE_SETTINGS: "temp_mail:update_settings",
} as const;

export const TEMPMAIL_STORAGE_KEYS = {
  STATE: "local:temp_mail:state",
  INBOX_CACHE: "local:temp_mail:inbox",
  SETTINGS: "local:temp_mail:settings",
} as const;

export const TEMPMAIL_CONFIG = {
  API_BASE: "https://api.tempmail.ing",
  DEFAULT_DURATION: 60,
  POLL_INTERVAL_SEC: 60,
  REQUEST_TIMEOUT_MS: 10_000,
} as const;
