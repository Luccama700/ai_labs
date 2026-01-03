/**
 * Local/OpenAI-Compatible Provider Adapter
 * For use with local LLMs (Ollama, LM Studio, etc.) or custom OpenAI-compatible APIs
 */

import {
  BaseProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  ProviderTestResult,
} from './types';
import { redactApiKey } from '../encryption';

interface LocalChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LocalUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface LocalChatResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason?: string;
  }>;
  usage?: LocalUsage;
}

export class LocalAdapter extends BaseProviderAdapter {
  readonly name = 'local';
  readonly displayName = 'Local/OpenAI-Compatible';
  
  // Common local models - users can specify any model name
  private readonly supportedModels = [
    'default',
    'llama2',
    'llama3',
    'mistral',
    'mixtral',
    'codellama',
    'phi',
    'gemma',
  ];
  
  getDefaultModel(): string {
    return 'default';
  }
  
  getSupportedModels(): string[] {
    return [...this.supportedModels];
  }
  
  async fetchAvailableModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    if (!baseUrl) {
      return this.getSupportedModels();
    }
    
    try {
      // Try OpenAI-compatible /models endpoint
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: apiKey ? {
          'Authorization': `Bearer ${apiKey}`,
        } : {},
      });
      
      if (!response.ok) {
        // Try Ollama-style /api/tags endpoint
        const ollamaResponse = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
        });
        
        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json() as { models: Array<{ name: string }> };
          return data.models?.map((m) => m.name) || this.getSupportedModels();
        }
        
        return this.getSupportedModels();
      }
      
      const data = await response.json() as { data: Array<{ id: string }> };
      
      const models = data.data?.map((model) => model.id).sort() || [];
      return models.length > 0 ? models : this.getSupportedModels();
    } catch {
      return this.getSupportedModels();
    }
  }
  
  async testConnection(apiKey: string, baseUrl?: string): Promise<ProviderTestResult> {
    if (!baseUrl) {
      return {
        success: false,
        message: 'Base URL is required for local/custom endpoints',
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Try the models endpoint first
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers,
      });
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        // Some local servers don't have /models, try /v1/models
        const v1Response = await fetch(`${baseUrl}/v1/models`, {
          method: 'GET',
          headers,
        }).catch(() => null);
        
        if (v1Response?.ok) {
          return {
            success: true,
            message: 'Connection successful',
            latencyMs: Date.now() - startTime,
          };
        }
        
        return {
          success: false,
          message: `Connection failed: HTTP ${response.status}`,
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
        message: `Connection error: ${message}`,
      };
    }
  }
  
  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    if (!request.baseUrl) {
      throw new Error('Base URL is required for local/custom endpoints');
    }
    
    const messages: LocalChatMessage[] = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    
    const requestBody: {
      model: string;
      messages: LocalChatMessage[];
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
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (request.apiKey) {
      headers['Authorization'] = `Bearer ${request.apiKey}`;
    }
    
    try {
      // Try standard endpoint first
      let url = `${request.baseUrl}/chat/completions`;
      let response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      
      // If that fails, try /v1/chat/completions
      if (!response.ok && response.status === 404) {
        url = `${request.baseUrl}/v1/chat/completions`;
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json() as LocalChatResponse;
      
      const choice = data.choices?.[0];
      if (!choice) {
        throw new Error('No response choices returned');
      }
      
      // Local models often don't return usage data
      const hasUsage = Boolean(data.usage?.prompt_tokens || data.usage?.completion_tokens);
      
      return {
        output: choice.message.content,
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
        tokensEstimated: !hasUsage,
        finishReason: choice.finish_reason || 'stop',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(request.apiKey ? redactApiKey(message, request.apiKey) : message);
    }
  }
}
