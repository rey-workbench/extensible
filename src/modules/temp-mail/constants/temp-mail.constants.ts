/**
 * Action and event constants specific to the TempMail module.
 */

export const TEMPMAIL_ACTIONS = {
  GET_CURRENT: 'tempmail:get_current',
  GENERATE_NEW: 'tempmail:generate_new',
  GET_INBOX: 'tempmail:get_inbox',
  DELETE_MESSAGE: 'tempmail:delete_message',
  AUTOFILL_ACTIVE_TAB: 'tempmail:autofill_active_tab',
  UPDATE_SETTINGS: 'tempmail:update_settings'
} as const;

export const TEMPMAIL_EVENTS = {
  STATE_CHANGED: 'tempmail:state_changed',
  EMAIL_GENERATED: 'tempmail:email_generated',
  INBOX_UPDATED: 'tempmail:inbox_updated',
  NEW_MESSAGE_RECEIVED: 'tempmail:new_message_received',
  SETTINGS_UPDATED: 'tempmail:settings_updated'
} as const;

export const TEMPMAIL_STORAGE_KEYS = {
  STATE: 'email_state',
  INBOX_CACHE: 'inbox_cache',
  SETTINGS: 'settings'
} as const;

export const TEMPMAIL_CONFIG = {
  API_BASE: 'https://api.tempmail.ing',
  DEFAULT_DURATION: 60,
  POLL_INTERVAL_SEC: 15,
  REQUEST_TIMEOUT_MS: 10_000
} as const;
