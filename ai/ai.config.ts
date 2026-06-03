import { createOllama } from "ai-sdk-ollama";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "qwen3";

let ollamaProvider: ReturnType<typeof createOllama> | null = null;

function getOllamaProvider() {
  if (!ollamaProvider) {
    ollamaProvider = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL,
    });
  }
  return ollamaProvider;
}

export function getAgentModel() {
  const modelId = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
  return getOllamaProvider()(modelId);
}
