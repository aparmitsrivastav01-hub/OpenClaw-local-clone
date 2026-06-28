import { isCancel, text } from "@clack/prompts";

/** Abstraction for conversation input — text today, voice tomorrow. */
export interface ConversationInputProvider {
  readonly source: "text" | "voice";
  /** Read the next user message. Returns null on cancel/exit. */
  read(): Promise<string | null>;
}

/** CLI text input via @clack/prompts. */
export class TextInputProvider implements ConversationInputProvider {
  readonly source = "text" as const;

  async read(): Promise<string | null> {
    const input = await text({
      message: "You",
      placeholder: "Ask anything, give a task, or type /help",
    });
    if (isCancel(input)) return null;
    const trimmed = (input ?? "").trim();
    return trimmed || null;
  }
}

/**
 * Voice input provider — wraps the voice module's listen pipeline.
 *
 * Instantiate when voice stack is configured; ConversationMode uses the
 * same routing and dispatch logic regardless of input source.
 */
export class VoiceInputProvider implements ConversationInputProvider {
  readonly source = "voice" as const;

  constructor(
    private readonly listen: () => Promise<string>,
  ) {}

  async read(): Promise<string | null> {
    return this.readWithRetry(0);
  }

  private async readWithRetry(attempt: number): Promise<string | null> {
    const MAX_RETRIES = 3;
    console.log("[VoiceInputProvider.read()] Starting listen()...");
    const transcript = await this.listen();
    console.log(`[VoiceInputProvider.read()] Transcript received: "${transcript}" (length=${transcript.length})`);
    const trimmed = transcript.trim();
    console.log(`[VoiceInputProvider.read()] Trimmed transcript: "${trimmed}" (length=${trimmed.length})`);
    
    // For voice input, empty transcription means silence - retry instead of exiting
    if (!trimmed) {
      if (attempt >= MAX_RETRIES) {
        console.log(`[VoiceInputProvider.read()] Max retries (${MAX_RETRIES}) reached, returning null to exit`);
        return null;
      }
      console.log(`[VoiceInputProvider.read()] Empty transcription (silence), retrying (${attempt + 1}/${MAX_RETRIES})...`);
      return this.readWithRetry(attempt + 1);
    }
    
    console.log(`[VoiceInputProvider.read()] Returning: "${trimmed}"`);
    return trimmed;
  }
}

/** Create the appropriate input provider based on config / env. */
export async function createInputProvider(
  source: "text" | "voice" = "text",
): Promise<ConversationInputProvider> {
  console.log(`[createInputProvider] source=${source}, VOICE_ENABLED=${process.env.VOICE_ENABLED}`);
  
  if (source === "voice" && process.env.VOICE_ENABLED === "1") {
    try {
      console.log("[createInputProvider] Creating voice stack...");
      const { createVoiceStack, createVoiceSession } = await import(
        "../../voice/index.ts"
      );
      const stack = createVoiceStack();
      console.log(`[createInputProvider] Voice stack created: STT=${stack.config.stt}, TTS=${stack.config.tts}, recorder=${stack.config.recorder}`);
      const session = createVoiceSession(stack);
      console.log("[createInputProvider] Voice session created, returning VoiceInputProvider");
      return new VoiceInputProvider(() => session.listen());
    } catch (err) {
      console.error("[createInputProvider] Voice stack creation failed:", err);
      console.log("[createInputProvider] Falling back to TextInputProvider");
      console.log("\n⚠️  Voice initialization failed. Falling back to text input.\n");
    }
  }
  console.log("[createInputProvider] Returning TextInputProvider");
  return new TextInputProvider();
}

/** Read a single message from any provider (used by voice always-on loop). */
export async function readMessage(
  provider: ConversationInputProvider,
): Promise<string | null> {
  return provider.read();
}
