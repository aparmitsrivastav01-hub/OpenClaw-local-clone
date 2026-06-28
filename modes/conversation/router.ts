import { generateText, Output } from "ai";
import { z } from "zod";
import { getAgentModel } from "../../ai/index.tsx";
import type { RouteMode, RouteResult } from "./types.ts";

const routeSchema = z.object({
  mode: z.enum(["ask", "agent", "plan"]),
  reason: z.string(),
});

const ROUTER_SYSTEM = `You are a routing classifier for OpenClaw, a local coding assistant.

Classify each user message into exactly one mode:

- ask: Questions, explanations, how/why queries, codebase exploration, or read-only research. No file changes or shell commands needed.
- agent: Concrete tasks requiring file edits, shell commands, bug fixes, or direct implementation work. Single focused goal.
- plan: Multi-step goals, large refactors, new features spanning many files, or projects that benefit from a structured plan before execution.

Choose the simplest mode that fits. Prefer ask for pure questions, agent for direct tasks, plan only when multiple coordinated steps are clearly needed.`;

/** Classify user input and select the appropriate internal mode. */
export async function routeMessage(message: string): Promise<RouteResult> {
  const result = await generateText({
    model: getAgentModel(),
    output: Output.object({ schema: routeSchema }),
    system: ROUTER_SYSTEM,
    prompt: message,
  });

  const parsed = routeSchema.parse(result.output);
  return { mode: parsed.mode as RouteMode, reason: parsed.reason };
}
