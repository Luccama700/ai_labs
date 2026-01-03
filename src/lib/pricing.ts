/**
 * Provider pricing configuration
 * Prices are per 1M tokens in USD
 * Updated: January 2026
 */

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  models: Record<string, ModelPricing>;
  defaultModel: string;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: {
      'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
      'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
      'gpt-4-turbo': { inputPer1M: 10.00, outputPer1M: 30.00 },
      'gpt-4': { inputPer1M: 30.00, outputPer1M: 60.00 },
      'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },
      'o1': { inputPer1M: 15.00, outputPer1M: 60.00 },
      'o1-mini': { inputPer1M: 3.00, outputPer1M: 12.00 },
    },
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    models: {
      'claude-sonnet-4-20250514': { inputPer1M: 3.00, outputPer1M: 15.00 },
      'claude-opus-4-20250514': { inputPer1M: 15.00, outputPer1M: 75.00 },
      'claude-3-5-sonnet-20241022': { inputPer1M: 3.00, outputPer1M: 15.00 },
      'claude-3-5-haiku-20241022': { inputPer1M: 0.80, outputPer1M: 4.00 },
      'claude-3-opus-20240229': { inputPer1M: 15.00, outputPer1M: 75.00 },
      'claude-3-sonnet-20240229': { inputPer1M: 3.00, outputPer1M: 15.00 },
      'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
    },
  },
  google: {
    name: 'google',
    displayName: 'Google Gemini',
    defaultModel: 'gemini-1.5-pro',
    models: {
      'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 },
      'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
      'gemini-1.5-flash-8b': { inputPer1M: 0.0375, outputPer1M: 0.15 },
      'gemini-2.0-flash-exp': { inputPer1M: 0.10, outputPer1M: 0.40 },
    },
  },
  deepseek: {
    name: 'deepseek',
    displayName: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: {
      'deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28 },
      'deepseek-reasoner': { inputPer1M: 0.55, outputPer1M: 2.19 },
    },
  },
  local: {
    name: 'local',
    displayName: 'Local/OpenAI-Compatible',
    defaultModel: 'default',
    models: {
      // Local models are typically free, but we set a small cost for tracking
      'default': { inputPer1M: 0.00, outputPer1M: 0.00 },
    },
  },
};

/**
 * Calculate estimated cost based on token counts
 */
export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): { cost: number; isEstimated: boolean } {
  const providerConfig = PROVIDER_CONFIGS[provider];
  
  if (!providerConfig) {
    // Unknown provider - use a conservative estimate
    return {
      cost: (inputTokens + outputTokens) * 0.00001, // $10 per 1M tokens
      isEstimated: true,
    };
  }
  
  const modelPricing = providerConfig.models[model];
  
  if (!modelPricing) {
    // Unknown model - use the provider's default model pricing
    const defaultPricing = providerConfig.models[providerConfig.defaultModel];
    if (defaultPricing) {
      const cost = 
        (inputTokens / 1_000_000) * defaultPricing.inputPer1M +
        (outputTokens / 1_000_000) * defaultPricing.outputPer1M;
      return { cost, isEstimated: true };
    }
    return {
      cost: (inputTokens + outputTokens) * 0.00001,
      isEstimated: true,
    };
  }
  
  const cost = 
    (inputTokens / 1_000_000) * modelPricing.inputPer1M +
    (outputTokens / 1_000_000) * modelPricing.outputPer1M;
  
  return { cost, isEstimated: false };
}

/**
 * Estimate token count from text using a simple heuristic
 * Rule of thumb: ~4 characters per token for English text
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Average of ~4 chars per token, but account for whitespace and punctuation
  return Math.ceil(text.length / 4);
}

/**
 * Get available models for a provider
 */
export function getModelsForProvider(provider: string): string[] {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return [];
  return Object.keys(config.models);
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): Array<{ name: string; displayName: string }> {
  return Object.values(PROVIDER_CONFIGS).map((p) => ({
    name: p.name,
    displayName: p.displayName,
  }));
}
