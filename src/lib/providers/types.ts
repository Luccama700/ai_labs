/**
 * Provider Adapter Interface
 * Defines the contract for all AI provider adapters
 */

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderRequest {
  messages: ProviderMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  apiKey: string;
  baseUrl?: string; // For custom/local endpoints
}

export interface ProviderResponse {
  output: string;
  inputTokens: number | null; // null if not provided by API
  outputTokens: number | null;
  totalTokens: number | null;
  tokensEstimated: boolean; // true if we estimated tokens ourselves
  finishReason?: string;
  rawResponse?: unknown; // For debugging, optional
}

export interface ProviderTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface ProviderAdapter {
  /**
   * Unique identifier for this provider
   */
  readonly name: string;
  
  /**
   * Human-readable display name
   */
  readonly displayName: string;
  
  /**
   * Test if an API key is valid by making a minimal API call
   */
  testConnection(apiKey: string, baseUrl?: string): Promise<ProviderTestResult>;
  
  /**
   * Execute a completion request
   * @param request The request parameters
   * @returns The completion response with token usage
   */
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  
  /**
   * Get the default model for this provider
   */
  getDefaultModel(): string;
  
  /**
   * Get list of supported models (fallback/static list)
   */
  getSupportedModels(): string[];
  
  /**
   * Fetch available models from the API dynamically
   * Returns model IDs that can be used with this provider
   */
  fetchAvailableModels(apiKey: string, baseUrl?: string): Promise<string[]>;
}

/**
 * Base class with common functionality for adapters
 */
export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract testConnection(apiKey: string, baseUrl?: string): Promise<ProviderTestResult>;
  abstract complete(request: ProviderRequest): Promise<ProviderResponse>;
  abstract getDefaultModel(): string;
  abstract getSupportedModels(): string[];
  
  /**
   * Default implementation returns static list - override for dynamic fetching
   */
  async fetchAvailableModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    return this.getSupportedModels();
  }
  
  /**
   * Estimate tokens from text using simple heuristic
   */
  protected estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Calculate total tokens from messages
   */
  protected estimateInputTokens(messages: ProviderMessage[]): number {
    return messages.reduce((sum, msg) => {
      return sum + this.estimateTokens(msg.content) + 4; // 4 tokens overhead per message
    }, 0);
  }
}
