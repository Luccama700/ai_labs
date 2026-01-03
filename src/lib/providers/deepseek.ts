/**
 * DeepSeek Provider Adapter
 * DeepSeek uses an OpenAI-compatible API
 */

import {
  BaseProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  ProviderTestResult,
} from './types';
import { redactApiKey } from '../encryption';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';

interface DeepSeekChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface DeepSeekChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: DeepSeekUsage;
}

interface DeepSeekError {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}

export class DeepSeekAdapter extends BaseProviderAdapter {
  readonly name = 'deepseek';
  readonly displayName = 'DeepSeek';
  
  private readonly supportedModels = [
    'deepseek-chat',
    'deepseek-reasoner',
  ];
  
  getDefaultModel(): string {
    return 'deepseek-chat';
  }
  
  getSupportedModels(): string[] {
    return [...this.supportedModels];
  }
  
  async fetchAvailableModels(apiKey: string): Promise<string[]> {
    try {
      const response = await fetch(`${DEEPSEEK_API_URL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      if (!response.ok) {
        return this.getSupportedModels();
      }
      
      const data = await response.json() as { data: Array<{ id: string }> };
      
      const models = data.data
        .map((model) => model.id)
        .filter((id) => id.startsWith('deepseek'))
        .sort();
      
      return models.length > 0 ? models : this.getSupportedModels();
    } catch {
      return this.getSupportedModels();
    }
  }
  
  async testConnection(apiKey: string): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${DEEPSEEK_API_URL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as DeepSeekError;
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
    const messages: DeepSeekChatMessage[] = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    
    const requestBody: {
      model: string;
      messages: DeepSeekChatMessage[];
      max_tokens?: number;
      temperature?: number;
      stream: boolean;
    } = {
      model: request.model,
      messages,
      stream: false,
    };
    
    if (request.maxTokens) {
      requestBody.max_tokens = request.maxTokens;
    }
    if (request.temperature !== undefined) {
      requestBody.temperature = request.temperature;
    }
    
    try {
      const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${request.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as DeepSeekError;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(redactApiKey(errorMessage, request.apiKey));
      }
      
      const data = await response.json() as DeepSeekChatResponse;
      
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
