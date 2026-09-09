/**
 * TempMail constants.
 */
import type { TempMailSettings } from "../types/temp-mail.types";

export const DEFAULT_TEMPMAIL_SETTINGS: TempMailSettings = {
  showFloatingButton: true,
};

export const TEMPMAIL_ACTIONS = {
  GET_CURRENT: "tempmail:get_current",
  GENERATE_NEW: "tempmail:generate_new",
  GET_INBOX: "tempmail:get_inbox",
  DELETE_MESSAGE: "tempmail:delete_message",
  AUTOFILL_ACTIVE_TAB: "tempmail:autofill_active_tab",
  AUTOFILL_EMAIL: "tempmail:autofill_email",
  UPDATE_SETTINGS: "tempmail:update_settings",
} as const;

export const TEMPMAIL_STORAGE_KEYS = {
  STATE: "local:tempmail:state",
  INBOX_CACHE: "local:tempmail:inbox",
  SETTINGS: "local:tempmail:settings",
} as const;

export const TEMPMAIL_CONFIG = {
  API_BASE: "https://api.tempmail.ing",
  DEFAULT_DURATION: 60,
  POLL_INTERVAL_SEC: 15,
  REQUEST_TIMEOUT_MS: 10_000,
} as const;
