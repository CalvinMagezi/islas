/**
 * OpenRouter model pricing — cost per 1M tokens (USD).
 * Update this table when switching models or when pricing changes.
 * Prices sourced from OpenRouter model cards.
 */

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Moonshot
  "moonshotai/kimi-k2.5": { inputPer1M: 0.50, outputPer1M: 2.80 },
  "moonshotai/kimi-k2": { inputPer1M: 0.50, outputPer1M: 2.80 },

  // Anthropic
  "anthropic/claude-sonnet-4": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "anthropic/claude-3.5-sonnet": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "anthropic/claude-3-haiku": { inputPer1M: 0.25, outputPer1M: 1.25 },

  // OpenAI
  "openai/gpt-4o": { inputPer1M: 2.50, outputPer1M: 10.0 },
  "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "openai/gpt-4.1-mini": { inputPer1M: 0.40, outputPer1M: 1.60 },

  // Google
  "google/gemini-2.5-flash": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "google/gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10.0 },

  // DeepSeek
  "deepseek/deepseek-chat-v3": { inputPer1M: 0.27, outputPer1M: 1.10 },
  "deepseek/deepseek-r1": { inputPer1M: 0.55, outputPer1M: 2.19 },

  // Meta
  "meta-llama/llama-4-maverick": { inputPer1M: 0.20, outputPer1M: 0.60 },
};

// Conservative fallback for unknown models
const DEFAULT_PRICING: ModelPricing = { inputPer1M: 1.0, outputPer1M: 3.0 };

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  return (
    (promptTokens * pricing.inputPer1M + completionTokens * pricing.outputPer1M) /
    1_000_000
  );
}

export function getModelPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? DEFAULT_PRICING;
}
