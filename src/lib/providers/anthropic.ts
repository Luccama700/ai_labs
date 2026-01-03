/**
 * Anthropic Provider Adapter
 */

import {
  BaseProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  ProviderTestResult,
} from './types';
import { redactApiKey } from '../encryption';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: AnthropicUsage;
}

interface AnthropicError {
  error: {
    type: string;
    message: string;
  };
}

export class AnthropicAdapter extends BaseProviderAdapter {
  readonly name = 'anthropic';
  readonly displayName = 'Anthropic';
  
  private readonly supportedModels = [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];
  
  getDefaultModel(): string {
    return 'claude-sonnet-4-20250514';
  }
  
  getSupportedModels(): string[] {
    return [...this.supportedModels];
  }
  
  async fetchAvailableModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    const url = baseUrl || ANTHROPIC_API_URL;
    
    try {
      const response = await fetch(`${url}/models`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      
      if (!response.ok) {
        return this.getSupportedModels();
      }
      
      const data = await response.json() as { data: Array<{ id: string; type: string }> };
      
      const models = data.data
        .filter((model) => model.type === 'model')
        .map((model) => model.id)
        .sort((a, b) => {
          // Sort by model generation (4 > 3.5 > 3) then by capability
          const getScore = (id: string) => {
            if (id.includes('opus-4') || id.includes('sonnet-4')) return 100;
            if (id.includes('3-5') || id.includes('3.5')) return 90;
            if (id.includes('opus')) return 80;
            if (id.includes('sonnet')) return 70;
            if (id.includes('haiku')) return 60;
            return 50;
          };
          return getScore(b) - getScore(a);
        });
      
      return models.length > 0 ? models : this.getSupportedModels();
    } catch {
      return this.getSupportedModels();
    }
  }
  
  async testConnection(apiKey: string, baseUrl?: string): Promise<ProviderTestResult> {
    const url = baseUrl || ANTHROPIC_API_URL;
    const startTime = Date.now();
    
    try {
      // Anthropic doesn't have a simple test endpoint, so we make a minimal request
      const response = await fetch(`${url}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as AnthropicError;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        // Check if it's an auth error vs other errors
        if (response.status === 401) {
          return {
            success: false,
            message: 'Invalid API key',
            latencyMs,
          };
        }
        return {
          success: false,
          message: redactApiKey(`Connection test failed: ${errorMessage}`, apiKey),
          latencyMs,
        };
      }
      
      return {
        success: true,
        message: 'Connection successful',
        latencyMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: redactApiKey(`Connection error: ${message}`, apiKey),
      };
    }
  }
  
  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const url = request.baseUrl || ANTHROPIC_API_URL;
    
    // Extract system message if present
    let systemPrompt: string | undefined;
    const messages: AnthropicMessage[] = [];
    
    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }
    
    const requestBody: AnthropicRequest = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 4096,
    };
    
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }
    
    if (request.temperature !== undefined) {
      requestBody.temperature = request.temperature;
    }
    
    try {
      const response = await fetch(`${url}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': request.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as AnthropicError;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(redactApiKey(errorMessage, request.apiKey));
      }
      
      const data = await response.json() as AnthropicResponse;
      
      const textContent = data.content.find((c) => c.type === 'text');
      const output = textContent?.text || '';
      
      return {
        output,
        inputTokens: data.usage?.input_tokens ?? null,
        outputTokens: data.usage?.output_tokens ?? null,
        totalTokens: data.usage 
          ? data.usage.input_tokens + data.usage.output_tokens 
          : null,
        tokensEstimated: !data.usage,
        finishReason: data.stop_reason,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(redactApiKey(message, request.apiKey));
    }
  }
}
