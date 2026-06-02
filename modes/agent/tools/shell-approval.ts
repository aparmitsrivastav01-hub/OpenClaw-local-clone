/**
 * shell-approval.ts
 * Built-in CLI approval handler for the OpenClaw shell execution module.
 *
 * Provides a human-readable, interactive prompt in terminal environments.
 * For headless / CI environments supply a custom `approvalHandler` via
 * `ShellExecuteOptions` instead.
 */

declare const Bun: any;

import type {
  ApprovalHandler,
  RiskLevel,
  ShellApprovalRequest,
  ShellApprovalResponse,
} from "./shell-types";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY ?? false;

const ansi = {
  reset: isTTY ? "\x1b[0m" : "",
  bold: isTTY ? "\x1b[1m" : "",
  dim: isTTY ? "\x1b[2m" : "",
  red: isTTY ? "\x1b[31m" : "",
  yellow: isTTY ? "\x1b[33m" : "",
  green: isTTY ? "\x1b[32m" : "",
  cyan: isTTY ? "\x1b[36m" : "",
  white: isTTY ? "\x1b[37m" : "",
  bgRed: isTTY ? "\x1b[41m" : "",
  bgYellow: isTTY ? "\x1b[43m" : "",
  bgBlue: isTTY ? "\x1b[44m" : "",
};

// ─── Risk badge ───────────────────────────────────────────────────────────────

function riskBadge(risk: RiskLevel): string {
  switch (risk) {
    case "low":
      return `${ansi.bgBlue}${ansi.bold}${ansi.white}  LOW   ${ansi.reset}`;
    case "medium":
      return `${ansi.bgYellow}${ansi.bold}  MEDIUM ${ansi.reset}`;
    case "high":
      return `${ansi.bgRed}${ansi.bold}${ansi.white}  HIGH  ${ansi.reset}`;
  }
}

function riskColor(risk: RiskLevel): string {
  switch (risk) {
    case "low":
      return ansi.cyan;
    case "medium":
      return ansi.yellow;
    case "high":
      return ansi.red;
  }
}

// ─── Prompt helper (Bun-native) ───────────────────────────────────────────────

/**
 * Reads a single line from stdin using Bun's synchronous `prompt()`.
 * Falls back to a simple stdin readline for non-interactive environments.
 */
async function readLine(promptText: string): Promise<string> {
  // Bun exposes a synchronous `prompt()` global (like browsers).
  if (typeof prompt === "function") {
    const answer = prompt(promptText) ?? "";
    return answer.trim();
  }

  // Fallback: async readline via Bun's stdin reader.
  process.stdout.write(promptText);
  const reader = Bun.stdin.stream().getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    // Stop at newline.
    if (value.includes(0x0a)) break;
  }

  reader.releaseLock();
  return Buffer.concat(chunks).toString("utf8").trim();
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function printApprovalBanner(request: ShellApprovalRequest): void {
  const { command, risk, workingDirectory } = request;
  const rc = riskColor(risk);
  const divider = `${ansi.dim}${"─".repeat(60)}${ansi.reset}`;

  console.log();
  console.log(divider);
  console.log(
    `${ansi.bold}⚡ Shell Approval Required${ansi.reset}  ${riskBadge(risk)}`
  );
  console.log(divider);
  console.log(
    `${ansi.dim}Command  ${ansi.reset}${rc}${ansi.bold}${command}${ansi.reset}`
  );
  console.log(
    `${ansi.dim}CWD      ${ansi.reset}${ansi.white}${workingDirectory}${ansi.reset}`
  );
  console.log(
    `${ansi.dim}Risk     ${ansi.reset}${rc}${risk.toUpperCase()}${ansi.reset}`
  );
  console.log(divider);
}

// ─── Default CLI approval handler ────────────────────────────────────────────

/**
 * Interactive terminal approval handler.
 *
 * Presents a formatted banner and waits for `y` / `n` input.
 * Non-TTY environments auto-deny HIGH commands and auto-approve others.
 */
export const cliApprovalHandler: ApprovalHandler = async (
  request: ShellApprovalRequest
): Promise<ShellApprovalResponse> => {
  printApprovalBanner(request);

  if (!isTTY) {
    const message =
      "Non-interactive terminal detected; HIGH-risk commands are auto-denied.";
    console.warn(`${ansi.yellow}⚠  ${message}${ansi.reset}`);
    return {
      approved: false,
      reason: message,
    };
  }

  const answer = await readLine(
    `${ansi.bold}Allow execution? [y/N]${ansi.reset} `
  );

  if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
    console.log(`${ansi.green}✔ Approved${ansi.reset}`);
    return { approved: true };
  }

  console.log(`${ansi.red}✖ Denied${ansi.reset}`);
  return {
    approved: false,
    reason: "User denied execution at the approval prompt.",
  };
};

// ─── Auto-deny handler (useful for tests / CI) ────────────────────────────────

/**
 * Approval handler that always denies.
 * Useful for locked-down CI pipelines or test suites.
 */
export const autoDenyHandler: ApprovalHandler = async (
  request: ShellApprovalRequest
): Promise<ShellApprovalResponse> => {
  return {
    approved: false,
    reason: `Auto-deny policy: ${request.risk.toUpperCase()}-risk command blocked.`,
  };
};

// ─── Auto-approve handler (useful for fully-trusted environments) ─────────────

/**
 * Approval handler that always approves.
 *
 * ⚠️  Use only in fully-trusted, sandboxed environments where you have
 *     absolute confidence in the commands being executed.
 */
export const autoApproveHandler: ApprovalHandler = async (
  _request: ShellApprovalRequest
): Promise<ShellApprovalResponse> => {
  return { approved: true };
};

// ─── Utility: build a threshold-gate handler ─────────────────────────────────

const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Wraps an inner handler so it is only invoked when the command's risk level
 * is >= `threshold`. Commands below the threshold are auto-approved silently.
 *
 * @example
 * // Only prompt for HIGH commands (default behaviour in shell-tool.ts)
 * const handler = withThreshold(cliApprovalHandler, "high");
 */
export function withThreshold(
  inner: ApprovalHandler,
  threshold: RiskLevel
): ApprovalHandler {
  return async (request: ShellApprovalRequest): Promise<ShellApprovalResponse> => {
    if (RISK_ORDER[request.risk] >= RISK_ORDER[threshold]) {
      return inner(request);
    }
    return { approved: true };
  };
}