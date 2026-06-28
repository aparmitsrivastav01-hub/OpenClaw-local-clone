import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import { routeMessage } from "./router.ts";
import {
  createInputProvider,
  type ConversationInputProvider,
} from "./input.ts";
import type { ConversationOptions, ConversationTurnOptions, RouteMode } from "./types.ts";
import { runAskMode } from "../ask/orchestrator.ts";
import { runAgentMode } from "../agent/orchestrator.ts";
import { runPlanMode } from "../plan/orchestrator.ts";
import { runDeveloperMenu } from "../developer.ts";
import { runTelegramMode } from "../telegram/index.ts";
import { createVoiceStack } from "../../voice/factory.ts";
import {
  formatTtsStartupLine,
  loadVoiceConfig,
  validateTtsSetup,
} from "../../voice/index.ts";
import { VoiceSession } from "../../voice/session/voice-session.ts";

const MODE_LABEL: Record<RouteMode, string> = {
  ask: "answer",
  agent: "execute",
  plan: "plan",
};

function printHelp() {
  console.log(chalk.dim(`
  Commands:
    /help     Show this help
    /menu     Open menu (Developer, Telegram, Exit)
    /dev      Developer menu (Ask, Agent, Plan modes)
    /voice    Toggle voice input (when configured)
    /exit     Leave conversation
`));
}

async function handleSlashCommand(
  cmd: string,
): Promise<"continue" | "exit"> {
  switch (cmd) {
    case "/help":
      printHelp();
      return "continue";

    case "/exit":
    case "/quit":
      return "exit";

    case "/menu": {
      const choice = await select({
        message: "Menu",
        options: [
          { value: "continue", label: "← Back to conversation" },
          { value: "dev", label: "Developer menu" },
          { value: "telegram", label: "Telegram bot" },
          { value: "exit", label: "Exit" },
        ],
      });
      if (isCancel(choice) || choice === "continue") return "continue";
      if (choice === "exit") return "exit";
      if (choice === "dev") {
        await runDeveloperMenu();
        return "continue";
      }
      if (choice === "telegram") {
        await runTelegramMode();
        return "continue";
      }
      return "continue";
    }

    case "/dev":
    case "/debug":
      await runDeveloperMenu();
      return "continue";

    case "/voice":
      if (process.env.VOICE_ENABLED === "1") {
        console.log(chalk.dim("  Voice input is enabled for this session.\n"));
      } else {
        console.log(
          chalk.yellow(
            "  Voice not enabled. Set VOICE_ENABLED=1 and configure voice/ providers.\n",
          ),
        );
      }
      return "continue";

    default:
      console.log(chalk.yellow(`  Unknown command: ${cmd}. Type /help for options.\n`));
      return "continue";
  }
}

/** Dispatch a classified message to the appropriate internal mode. */
export async function dispatchToMode(
  mode: RouteMode,
  message: string,
): Promise<string> {
  switch (mode) {
    case "ask":
      return await runAskMode({ input: message, fromConversation: true });
    case "agent":
      return await runAgentMode({ input: message, fromConversation: true });
    case "plan":
      return await runPlanMode({ input: message, fromConversation: true });
    default:
      return "";
  }
}

/** Process a single conversation turn: route → dispatch. */
export async function processConversationTurn(
  message: string,
  options?: ConversationTurnOptions,
): Promise<string> {
  let mode: RouteMode;

  if (options?.forceMode) {
    mode = options.forceMode;
  } else {
    if (!options?.quiet) {
      process.stdout.write(chalk.dim("  routing… "));
    }
    const route = await routeMessage(message);
    mode = route.mode;
    if (!options?.quiet) {
      console.log(chalk.dim(`→ ${MODE_LABEL[mode]}`));
    }
  }

  return await dispatchToMode(mode, message);
}

/** Main conversation loop — primary OpenClaw CLI experience. */
export async function runConversationMode(options?: ConversationOptions) {
  const source =
    options?.inputSource ??
    (process.env.VOICE_ENABLED === "1" ? "voice" : "text");

  console.log(chalk.bold("\n💬 Conversation\n"));
  console.log(
    chalk.dim(
      "Ask questions, give tasks, or describe goals — OpenClaw picks the right approach.\n",
    ),
  );
  
  // Startup diagnostics
  let voiceSession: VoiceSession | null = null;
  if (source === "voice") {
    const voiceConfig = loadVoiceConfig();
    console.log(chalk.dim("Voice Enabled: true"));
    console.log(chalk.dim("Input Source: voice"));
    console.log(
      chalk.dim(`STT: ${process.env.VOICE_STT_PROVIDER || "faster-whisper"}`),
    );
    console.log(
      chalk.dim(`TTS configured: ${voiceConfig.tts}`),
    );
    console.log(chalk.dim(`Recorder: ${process.env.VOICE_RECORDER || "node"}`));
    if (process.env.VOICE_DSHOW_DEVICE) {
      console.log(
        chalk.dim(`Microphone Device: ${process.env.VOICE_DSHOW_DEVICE}`),
      );
    }

    const ttsCheck = validateTtsSetup(voiceConfig);
    for (const w of ttsCheck.warnings) {
      console.log(chalk.yellow(`  ⚠ ${w}`));
    }
    for (const h of ttsCheck.hints) {
      console.log(chalk.dim(`  · ${h}`));
    }

    try {
      const voiceStack = createVoiceStack({ config: voiceConfig });
      console.log(chalk.dim(formatTtsStartupLine(voiceStack.tts)));
      voiceSession = new VoiceSession(
        voiceStack.stt,
        voiceStack.tts,
        voiceStack.recorder,
        voiceStack.playback,
      );
      console.log(chalk.dim("Voice session ready.\n"));
    } catch (err) {
      console.error(
        chalk.yellow("Voice stack initialization issue:"),
        err instanceof Error ? err.message : err,
      );
      console.log(
        chalk.dim("Continuing — text responses work; speech may be disabled.\n"),
      );
    }
  } else {
    console.log(chalk.dim("Type /help for commands.\n"));
  }

  const inputProvider = await createInputProvider(source);

  while (true) {
    const message = await inputProvider.read();
    if (message === null) {
      console.log(chalk.dim("\nGoodbye.\n"));
      return;
    }

    if (message.startsWith("/")) {
      const cmd = message.split(/\s+/)[0]?.toLowerCase() ?? message;
      const result = await handleSlashCommand(cmd);
      if (result === "exit") {
        console.log(chalk.dim("\nGoodbye.\n"));
        return;
      }
      continue;
    }

    const response = await processConversationTurn(message);
    
    // TTS output for voice sessions
    if (voiceSession && response?.trim()) {
      try {
        console.log(chalk.dim("  [TTS] Synthesizing response..."));
        await voiceSession.speak(response);
      } catch (err) {
        console.error(chalk.yellow("  [TTS] Failed to synthesize/play response:"), err);
        // Continue conversation even if TTS fails
      }
    }
    
    console.log();
  }
}
