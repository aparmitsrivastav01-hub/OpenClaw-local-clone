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
          "You have access to web_search and web_scrape tools for internet access.",
          "Use web_search when you need to find URLs or general information about a topic. It searches the internet and scrapes the top 3-5 pages in parallel to return full markdown content with citations.",
          "Use web_scrape when you need the full content of a specific URL that you already have.",
          "Use these tools for: latest news, current events, sports, weather, factual information unavailable in context, product information, company information, stock prices, cryptocurrency prices, and live data.",
          "Never hallucinate recent information if web_search is available. Always search for up-to-date information when the user asks about current events or time-sensitive data.",
        ].join("\n"),
        tools,
      });

      console.log("========================");
      console.log("LLM REQUEST");
      console.log("========================");
      console.log(`Model: ${getAgentModel()}`);
      console.log(`Tool count: ${Object.keys(tools).length}`);
      console.log("========================");

      const result = await agent.generate({
        prompt: goal,
        onStepFinish: ({ toolCalls }) => {
          console.log("========================");
          console.log("MODEL REQUESTED TOOL");
          console.log("========================");
          for (const tc of toolCalls) {
            console.log(`Tool: ${tc.toolName}`);
            console.log(`Arguments: ${JSON.stringify(tc.input)}`);
            const preview = JSON.stringify(tc.input).slice(0, 160);
            console.log(
              chalk.green("  ✓"),
              chalk.bold(String(tc.toolName)),
              chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
            );
          }
          console.log("========================");
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