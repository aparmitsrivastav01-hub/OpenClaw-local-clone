# openclaw

Local AI agent CLI (Agent / Plan / Ask modes) powered by [Ollama](https://ollama.com) and the Vercel AI SDK.

## Prerequisites

1. [Ollama](https://ollama.com) running locally (`ollama serve`)
2. Default model pulled: `ollama pull qwen3`
3. [Bun](https://bun.com)

## Setup

```bash
bun install
cp .env.example .env   # optional — defaults work for local Ollama
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen3` | Model name (must exist in `ollama list`) |
| `FIRECRAWL_API_KEY` | — | Optional web tools in Plan/Ask |

## Run

```bash
bun run index.ts wakeup
```

## Validate Ollama integration

```bash
bun scripts/validate-ollama.ts
```
