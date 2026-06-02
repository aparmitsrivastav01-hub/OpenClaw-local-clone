/**
 * shell-tool.ts
 * Standalone shell execution module for the OpenClaw clone.
 *
 * Runtime: Bun (https://bun.sh)
 * No external runtime dependencies — uses Bun.spawn exclusively.
 *
 * Usage:
 *   import { executeShell } from "./shell-tool";
 *
 *   const result = await executeShell("git status");
 *   const result = await executeShell("bun install", { cwd: "/my/project" });
 */

// Provide a minimal ambient declaration for the Bun runtime so TypeScript
// compilation succeeds in environments without @types/bun installed.
// Replace `any` with more specific types or install `@types/bun` if desired.
declare const Bun: any;

import {
  cliApprovalHandler,
  withThreshold,
} from "./shell-approval";

import {
  COMMAND_RISK_MAP,
  type ApprovalHandler,
  type RiskLevel,
  type ShellApprovalRequest,
  type ShellResult,
  type ShellExecuteOptions,
} from "./shell-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_APPROVAL_THRESHOLD: RiskLevel = "high";

// ─── Risk classification ──────────────────────────────────────────────────────

/**
 * Classify the risk level of a raw command string.
 *
 * Strategy (in priority order):
 * 1. Check exact full command match (e.g. `"git status"` → low).
 * 2. Check the first two tokens (`git add`, `npm install`, …).
 * 3. Check the bare executable name (`rm`, `shutdown`, …).
 * 4. Default to `"medium"` for any unrecognised command.
 */
export function classifyRisk(command: string): RiskLevel {
  const trimmed = command.trim();

  // 1. Exact match.
  const exact = COMMAND_RISK_MAP[trimmed.toLowerCase()];
  if (exact) return exact;

  const tokens = trimmed.split(/\s+/);

  // 2. Two-token prefix (e.g. "git status", "npm install").
  if (tokens.length >= 2) {
    const twoToken = `${tokens[0]!} ${tokens[1]!}`.toLowerCase();
    const twoRisk = COMMAND_RISK_MAP[twoToken];
    if (twoRisk) return twoRisk;
  }

  // 3. Bare executable (strip path separators: `/usr/bin/rm` → `rm`).
  const exe = tokens[0]!.split(/[/\\]/).pop()?.toLowerCase() ?? "";
  const exeRisk = COMMAND_RISK_MAP[exe];
  if (exeRisk) return exeRisk;

  // 4. Unknown → default to medium.
  return "medium";
}

// ─── Timeout race helper ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Command timed out after ${ms} ms`)),
      ms
    )
  );
}

// ─── Core executor ────────────────────────────────────────────────────────────

/**
 * Execute a shell command and return a structured `ShellResult`.
 *
 * Approval flow
 * ─────────────
 * By default only HIGH-risk commands require approval (via the interactive
 * CLI prompt).  Supply `approvalThreshold` and/or `approvalHandler` in
 * `options` to change this behaviour.
 *
 * Timeout
 * ───────
 * The subprocess is killed (SIGTERM → SIGKILL after 1 s) if it exceeds
 * `timeoutMs` (default 30 000 ms).  The returned `exitCode` will be `-1`
 * and `stderr` will contain the timeout message.
 *
 * @param command  Full shell command string (e.g. `"git status"`, `"bun install --frozen-lockfile"`).
 * @param options  Optional execution settings.
 * @returns        Resolved `ShellResult` (never rejects — errors surface via exitCode / stderr).
 *
 * @example
 * const res = await executeShell("git status");
 * console.log(res.stdout);
 *
 * @example
 * const res = await executeShell("bun install", { cwd: "/my/app" });
 * if (res.exitCode !== 0) console.error(res.stderr);
 */
export async function executeShell(
  command: string,
  options: ShellExecuteOptions = {}
): Promise<ShellResult> {
  const {
    cwd = process.cwd(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    approvalThreshold = DEFAULT_APPROVAL_THRESHOLD,
    env,
  } = options;

  // Resolve approval handler (wrap with threshold gate).
  const baseHandler: ApprovalHandler =
    options.approvalHandler ?? cliApprovalHandler;
  const approvalHandler = withThreshold(baseHandler, approvalThreshold);

  // ── 1. Classify risk ──────────────────────────────────────────────────────
  const risk = classifyRisk(command);

  // ── 2. Run approval flow ──────────────────────────────────────────────────
  const approvalRequest: ShellApprovalRequest = {
    command,
    risk,
    workingDirectory: cwd,
  };

  const approval = await approvalHandler(approvalRequest);

  if (!approval.approved) {
    const reason =
      approval.reason ?? "Execution was not approved.";
    return {
      command,
      exitCode: 126, // POSIX: command invoked cannot execute
      stdout: "",
      stderr: `[shell-tool] Execution denied. ${reason}`,
      durationMs: 0,
    };
  }

  // ── 3. Spawn subprocess ───────────────────────────────────────────────────
  const startTime = performance.now();

  // Split command into argv for Bun.spawn.
  // We deliberately use a simple whitespace split here so that the module
  // stays dependency-free.  For commands with quoted arguments, callers
  // should pass pre-tokenised args via `Bun.spawn` directly.
  const [exe, ...args] = tokenise(command);

  try {
    const proc = Bun.spawn([exe, ...args], {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    // Race subprocess completion against the timeout.
    const exitCode = await Promise.race<number>([
      proc.exited,
      sleep(timeoutMs),
    ]).catch(async (err: Error) => {
      // Kill the process tree on timeout.
      try {
        proc.kill("SIGTERM");
        await Bun.sleep(1_000);
        proc.kill("SIGKILL");
      } catch {
        // Already dead — ignore.
      }
      throw err;
    });

    const [stdoutRaw, stderrRaw] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    return {
      command,
      exitCode: exitCode ?? 1,
      stdout: stdoutRaw,
      stderr: stderrRaw,
      durationMs: Math.round(performance.now() - startTime),
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    const message = err instanceof Error ? err.message : String(err);

    return {
      command,
      exitCode: -1,
      stdout: "",
      stderr: `[shell-tool] ${message}`,
      durationMs,
    };
  }
}

// ─── Simple argv tokeniser ────────────────────────────────────────────────────

/**
 * Splits a command string into an argv array, respecting single-quoted and
 * double-quoted segments (no escape handling).
 *
 * Examples:
 *   `"git commit -m 'initial commit'"` → `["git","commit","-m","initial commit"]`
 *   `'echo "hello world"'`             → `["echo","hello world"]`
 */
export function tokenise(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

// ─── Batch executor ───────────────────────────────────────────────────────────

/**
 * Execute multiple commands sequentially, stopping on the first non-zero
 * exit code (unless `continueOnError` is `true`).
 *
 * @example
 * const results = await executeShellSequence([
 *   "git status",
 *   "bun install",
 *   "bun run build",
 * ]);
 */
export async function executeShellSequence(
  commands: string[],
  options: ShellExecuteOptions & { continueOnError?: boolean } = {}
): Promise<ShellResult[]> {
  const { continueOnError = false, ...execOptions } = options;
  const results: ShellResult[] = [];

  for (const cmd of commands) {
    const result = await executeShell(cmd, execOptions);
    results.push(result);

    if (result.exitCode !== 0 && !continueOnError) {
      break;
    }
  }

  return results;
}

// ─── Convenience formatters ───────────────────────────────────────────────────

/** Returns a compact one-line summary of a ShellResult. */
export function formatResult(result: ShellResult): string {
  const status = result.exitCode === 0 ? "✔" : "✖";
  const ms = `${result.durationMs}ms`;
  return `${status} [${result.exitCode}] (${ms}) $ ${result.command}`;
}

/** Pretty-prints a ShellResult to the console. */
export function printResult(result: ShellResult): void {
  console.log(formatResult(result));
  if (result.stdout) console.log(result.stdout.trimEnd());
  if (result.stderr) console.error(result.stderr.trimEnd());
}

// ─── Example / self-test (run with `bun shell-tool.ts`) ──────────────────────

if (import.meta.main) {
  console.log("─── OpenClaw Shell Tool — self-test ───\n");

  // LOW risk — no prompt.
  const r1 = await executeShell("git status");
  printResult(r1);
  console.log();

  // MEDIUM risk — no prompt with default threshold of "high".
  const r2 = await executeShell("bun install --dry-run");
  printResult(r2);
  console.log();

  // HIGH risk — triggers CLI approval prompt.
  // Uncomment to test interactively:
  // const r3 = await executeShell("rm -rf /tmp/openclaw-test");
  // printResult(r3);
}