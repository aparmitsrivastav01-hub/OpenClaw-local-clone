/**
 * shell-types.ts
 * Core type definitions for the OpenClaw shell execution module.
 */

// ─── Result ──────────────────────────────────────────────────────────────────

export interface ShellResult {
  /** The full command string that was executed. */
  command: string;
  /** Process exit code (0 = success). */
  exitCode: number;
  /** Captured standard output. */
  stdout: string;
  /** Captured standard error. */
  stderr: string;
  /** Wall-clock execution time in milliseconds. */
  durationMs: number;
}

// ─── Risk ────────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high";

export interface ShellApprovalRequest {
  /** The full command string pending approval. */
  command: string;
  /** Assessed risk level of the command. */
  risk: RiskLevel;
  /** Absolute path of the working directory. */
  workingDirectory: string;
}

export interface ShellApprovalResponse {
  approved: boolean;
  /** Optional human-readable reason (shown to user on rejection). */
  reason?: string;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ShellExecuteOptions {
  /** Working directory for the spawned process. Defaults to `process.cwd()`. */
  cwd?: string;
  /**
   * Timeout in milliseconds before the process is killed.
   * Defaults to 30 000 ms (30 seconds).
   */
  timeoutMs?: number;
  /**
   * Custom approval handler. Called for every command whose risk level
   * meets or exceeds `approvalThreshold`. Defaults to the built-in
   * interactive CLI prompt provided by `shell-approval.ts`.
   */
  approvalHandler?: ApprovalHandler;
  /**
   * Minimum risk level that triggers the approval flow.
   * - `"high"`   → only HIGH commands need approval  (default)
   * - `"medium"` → MEDIUM and HIGH commands need approval
   * - `"low"`    → every command needs approval
   */
  approvalThreshold?: RiskLevel;
  /** Extra environment variables merged on top of `process.env`. */
  env?: Record<string, string>;
}

// ─── Handler signature ───────────────────────────────────────────────────────

/**
 * An approval handler receives an approval request and must return a promise
 * that resolves to an `ShellApprovalResponse`.
 *
 * Implement this interface to plug in custom UIs (GUI dialogs, web sockets,
 * CI gates, etc.) without touching the core execution logic.
 */
export type ApprovalHandler = (
  request: ShellApprovalRequest
) => Promise<ShellApprovalResponse>;

// ─── Risk classification maps ─────────────────────────────────────────────────

/**
 * Token-level risk classification.
 *
 * Classification is performed on the *leading executable token* of the
 * command string (after stripping any leading path segments).
 *
 * Keys are lowercase command names; values are the associated risk level.
 */
export const COMMAND_RISK_MAP: Readonly<Record<string, RiskLevel>> = {
  // LOW ───────────────────────────────────────────────────────────────────────
  "git status": "low",
  pwd: "low",
  ls: "low",
  dir: "low",
  echo: "low",
  cat: "low",
  head: "low",
  tail: "low",
  wc: "low",
  date: "low",
  whoami: "low",
  hostname: "low",
  uname: "low",
  env: "low",
  printenv: "low",
  which: "low",
  where: "low",

  // MEDIUM ────────────────────────────────────────────────────────────────────
  "npm install": "medium",
  "bun install": "medium",
  "yarn install": "medium",
  "pnpm install": "medium",
  "git add": "medium",
  "git commit": "medium",
  "git push": "medium",
  "git pull": "medium",
  "git fetch": "medium",
  "git checkout": "medium",
  "git merge": "medium",
  "git rebase": "medium",
  "git stash": "medium",
  "git reset": "medium",
  mv: "medium",
  cp: "medium",
  mkdir: "medium",
  touch: "medium",
  chmod: "medium",
  chown: "medium",
  curl: "medium",
  wget: "medium",

  // HIGH ──────────────────────────────────────────────────────────────────────
  rm: "high",
  del: "high",
  rmdir: "high",
  "rm -rf": "high",
  "del /f": "high",
  shutdown: "high",
  reboot: "high",
  halt: "high",
  poweroff: "high",
  "mkfs": "high",
  "fdisk": "high",
  "dd": "high",
  "format": "high",
  "kill": "high",
  "killall": "high",
  "pkill": "high",
  "sudo": "high",
  "su": "high",
  "passwd": "high",
  "useradd": "high",
  "userdel": "high",
  "visudo": "high",
  "crontab": "high",
  "at": "high",
  "nc": "high",
  "ncat": "high",
  "netcat": "high",
} as const;