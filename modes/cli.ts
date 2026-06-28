import { runConversationMode } from "./conversation/orchestrator.ts";

/** Primary CLI entry — starts Conversation Mode immediately. */
export async function runCliMode() {
  await runConversationMode();
}
