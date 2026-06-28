import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import { runAgentMode } from "./agent/orchestrator.ts";
import { runAskMode } from "./ask/orchestrator.ts";
import { runPlanMode } from "./plan/orchestrator.ts";

/** Debug/Developer menu — direct access to Ask, Agent, and Plan modes. */
export async function runDeveloperMenu() {
  while (true) {
    console.log(chalk.bold("\n🔧 Developer\n"));

    const mode = await select({
      message: "Choose a mode",
      options: [
        { value: "ask", label: "Ask Mode" },
        { value: "agent", label: "Agent Mode" },
        { value: "plan", label: "Plan Mode" },
        { value: "back", label: "← Back to conversation" },
      ],
    });

    if (isCancel(mode) || mode === "back") return;

    if (mode === "agent") await runAgentMode();
    if (mode === "ask") await runAskMode();
    if (mode === "plan") await runPlanMode();
  }
}
