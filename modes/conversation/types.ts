/** Internal routing targets — maps to existing mode implementations. */
export type RouteMode = "ask" | "agent" | "plan";

export interface RouteResult {
  mode: RouteMode;
  reason: string;
}

export interface ConversationTurnOptions {
  /** Pre-supplied message (skips input read). Used by voice integration. */
  input?: string;
  /** Skip routing and force a specific mode (developer override). */
  forceMode?: RouteMode;
  /** Suppress routing indicator in the UI. */
  quiet?: boolean;
}

export interface ConversationOptions {
  /** Input source — text now, voice when enabled. */
  inputSource?: "text" | "voice";
}
