import Anthropic from "@anthropic-ai/sdk"

// Provider-agnostic AI interface. Everything above this file talks to
// AIProvider only — swapping Claude for another provider means writing one
// new class, not touching the feature actions.

export interface CompletionRequest {
  system?: string
  prompt: string
  maxTokens?: number
}

export interface AIProvider {
  complete(request: CompletionRequest): Promise<string>
  completeJSON<T>(request: CompletionRequest & { schema: Record<string, unknown> }): Promise<T>
}

const CLAUDE_MODEL = "claude-opus-4-8"

class ClaudeProvider implements AIProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async complete(request: CompletionRequest): Promise<string> {
    const response = await this.client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: request.maxTokens ?? 4096,
      thinking: { type: "adaptive" },
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
    })

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
  }

  async completeJSON<T>(
    request: CompletionRequest & { schema: Record<string, unknown> }
  ): Promise<T> {
    const response = await this.client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: request.maxTokens ?? 4096,
      thinking: { type: "adaptive" },
      system: request.system,
      output_config: {
        format: { type: "json_schema", schema: request.schema },
      },
      messages: [{ role: "user", content: request.prompt }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")

    return JSON.parse(text) as T
  }
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

let provider: AIProvider | null = null

export function getAIProvider(): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      "AI is not configured. Add ANTHROPIC_API_KEY to your environment (Vercel env vars + .env.local)."
    )
  }
  if (!provider) {
    provider = new ClaudeProvider(apiKey)
  }
  return provider
}
