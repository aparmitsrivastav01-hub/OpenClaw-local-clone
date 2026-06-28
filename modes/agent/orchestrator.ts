import { isCancel , text} from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { exec } from "node:child_process";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";
import { createAgentTools } from "./agent-tools";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { runApprovalFlow } from "./Approval";

export interface AgentModeOptions {
    input?: string;
    fromConversation?: boolean;
}

export async function runAgentMode(options?: AgentModeOptions): Promise<string> {
    if (!options?.fromConversation) {
        console.log(chalk.bold("\n🤖 Agent Mode\n"));
    }

    let goal = options?.input;
    if (!goal) {
        const prompted = await text({
            message: "What would you like the agent to do?",
            placeholder: "Concrete task for this codebase..",
        });
        if (isCancel(prompted) || !prompted.trim()) return "";
        goal = prompted.trim();
    }

    const config = defaultAgentConfig()
    const tracker = new ActionTracker()
    const executor = new ToolExecutor(tracker,config)
    const tools = createAgentTools(executor)
    
    const agent = new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(40),
        instructions: [
          `Workspace root: ${config.codebasePath}`,
          "All mutations are staged until approval.",
        ].join("\n"),
        tools,
      });

      const result = await agent.generate({
        prompt: goal,
        onStepFinish: ({ toolCalls }) => {
          for (const tc of toolCalls) {
            const preview = JSON.stringify(tc.input).slice(0, 160);
            console.log(
              chalk.green("  ✓"),
              chalk.bold(String(tc.toolName)),
              chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
            );
          }
        },
      });
      const responseText = result.text?.trim() || "";
      if (responseText) console.log(renderTerminalMarkdown(responseText));

      const ok = await runApprovalFlow(tracker);
      if (!ok) {
        executor.clearStaging();
        return responseText;
      }
    
      const { errors } = executor.applyApprovedFromTracker();
    
      if (errors.length) {
        console.log(chalk.red("\nSome operations reported errors:\n"));
        for (const e of errors) console.log(chalk.red(`  • ${e}`));
      }
      else{
       console.log(chalk.green('\n✓ Applied.\n'));
      }
    
      executor.clearStaging();
      return responseText;
    }