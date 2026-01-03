/**
 * OpenAI Provider Adapter
 * Fully implemented adapter for OpenAI's API
 */

import {
  BaseProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  ProviderTestResult,
} from './types';
import { redactApiKey } from '../encryption';

const OPENAI_API_URL = 'https://api.openai.com/v1';

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream: boolean;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChatChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatChoice[];
  usage: OpenAIUsage;
}

interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}

export class OpenAIAdapter extends BaseProviderAdapter {
  readonly name = 'openai';
  readonly displayName = 'OpenAI';
  
  private readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1',
    'o1-mini',
  ];
  
  getDefaultModel(): string {
    return 'gpt-4o';
  }
  
  getSupportedModels(): string[] {
    return [...this.supportedModels];
  }
  
  async fetchAvailableModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    const url = baseUrl || OPENAI_API_URL;
    
    try {
      const response = await fetch(`${url}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      if (!response.ok) {
        // Fall back to static list on error
        return this.getSupportedModels();
      }
      
      const data = await response.json() as { data: Array<{ id: string; object: string }> };
      
      // Filter to only chat models (gpt-*, o1-*, chatgpt-*)
      const chatModels = data.data
        .filter((model) => {
          const id = model.id.toLowerCase();
          return (
            id.startsWith('gpt-') ||
            id.startsWith('o1') ||
            id.startsWith('o3') ||
            id.startsWith('chatgpt-')
          ) && !id.includes('instruct') && !id.includes('realtime') && !id.includes('audio');
        })
        .map((model) => model.id)
        .sort((a, b) => {
          // Sort newer models first
          const order = ['o3', 'o1', 'gpt-4o', 'gpt-4', 'gpt-3.5', 'chatgpt'];
          const aIndex = order.findIndex((prefix) => a.toLowerCase().startsWith(prefix));
          const bIndex = order.findIndex((prefix) => b.toLowerCase().startsWith(prefix));
          if (aIndex !== bIndex) return aIndex - bIndex;
          return a.localeCompare(b);
        });
      
      return chatModels.length > 0 ? chatModels : this.getSupportedModels();
    } catch {
      return this.getSupportedModels();
    }
  }
  
  async testConnection(apiKey: string, baseUrl?: string): Promise<ProviderTestResult> {
    const url = baseUrl || OPENAI_API_URL;
    const startTime = Date.now();
    
    try {
      // Use models endpoint for a lightweight test
      const response = await fetch(`${url}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as OpenAIError;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        return {
          success: false,
          message: redactApiKey(`Connection failed: ${errorMessage}`, apiKey),
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
    const url = request.baseUrl || OPENAI_API_URL;
    
    const requestBody: OpenAIChatRequest = {
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
    };
    
    if (request.maxTokens) {
      requestBody.max_tokens = request.maxTokens;
    }
    
    if (request.temperature !== undefined) {
      requestBody.temperature = request.temperature;
    }
    
    try {
      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${request.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as OpenAIError;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(redactApiKey(errorMessage, request.apiKey));
      }
      
      const data = await response.json() as OpenAIChatResponse;
      
      const choice = data.choices[0];
      if (!choice) {
        throw new Error('No response choices returned');
      }
      
      return {
        output: choice.message.content,
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
        tokensEstimated: !data.usage,
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(redactApiKey(message, request.apiKey));
    }
  }
}
