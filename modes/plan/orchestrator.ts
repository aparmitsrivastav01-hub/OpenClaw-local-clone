import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agent/action-tracker.ts";
import { ToolExecutor } from "../agent/tool-executor.ts";
import { createAgentTools } from "../agent/agent-tools.ts";
import { defaultAgentConfig } from "../agent/types.ts";
import { runApprovalFlow } from "../agent/Approval.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";
import { generatePlan } from "./planner.ts";
import { printPlan, selectSteps } from "./selection.ts";
import type { PlanStep } from "./types.ts";
import { createWebTools } from "./web-tools.ts";


function stepPrompt(goal: string, step: PlanStep): string {
  return [`Goal: ${goal}`, `Step: ${step.title}`, step.description].join('\n');
}


export interface PlanModeOptions {
    input?: string;
    fromConversation?: boolean;
}

export async function runPlanMode(options?: PlanModeOptions): Promise<string> {
    if (!options?.fromConversation) {
        console.log(chalk.bold("\n🧭 Plan Mode\n"));
    }

    let goal = options?.input;
    if (!goal) {
        const prompted = await text({ message: "What is your goal?" });
        if (isCancel(prompted) || !prompted.trim()) return "";
        goal = prompted.trim();
    }
  
    const plan = await generatePlan(goal);
  
    printPlan(plan);
  
    const selected = await selectSteps(plan);
    if (selected.length === 0) return "";
  
    const proceed = await confirm({
      message: `Execute ${selected.length} step(s)`,
      initialValue: true,
    });

    if (isCancel(proceed) || !proceed) return "";
  
    const config = defaultAgentConfig();
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);
  
  
    const tools = {
      ...createAgentTools(executor),
      ...createWebTools(tracker)
    };

    let lastResponse = "";
  
    for (const step of selected) {
      console.log(chalk.bold(`\n🔧 ${step.title}\n`));
  
      const agent = new ToolLoopAgent({
        model:getAgentModel(),
        stopWhen:stepCountIs(30),
        tools
      });
  
      const r = await agent.generate({prompt:stepPrompt(plan.goal , step)})
  
      if(r.text) {
        lastResponse = r.text?.trim() || "";
        console.log(renderTerminalMarkdown(lastResponse));
      }
    }
  
    const ok = await runApprovalFlow(tracker);
  
    if(!ok) {
        executor.clearStaging();
        return lastResponse;
    }
  
     const { errors } = executor.applyApprovedFromTracker();
    if (errors.length) {
      console.log(chalk.red('\nSome operations reported errors:\n'));
      for (const e of errors) console.log(chalk.red(`  • ${e}`));
    } else {
      console.log(chalk.green('\n✓ Applied.\n'));
    }
    executor.clearStaging();
    return lastResponse;
  }