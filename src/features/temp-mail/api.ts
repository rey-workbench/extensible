import { sendMessage } from "@/lib/messaging";
import { TEMPMAIL_ACTIONS } from "./constants/temp-mail.constants";
import type { TempEmail, TempMailCurrentState } from "./types/temp-mail.types";

export type { TempEmail, TempMailCurrentState };

export const tempMailApi = {
  getCurrentState: (opts?: { autoGenerate?: boolean }) =>
    sendMessage<TempMailCurrentState>(TEMPMAIL_ACTIONS.GET_CURRENT, opts),
  generateNewAddress: () => sendMessage<TempEmail>(TEMPMAIL_ACTIONS.GENERATE_NEW),
};
