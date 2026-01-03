/**
 * Google Gemini Provider Adapter
 */

import {
  BaseProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  ProviderTestResult,
} from './types';
import { redactApiKey } from '../encryption';

const GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

export class GoogleAdapter extends BaseProviderAdapter {
  readonly name = 'google';
  readonly displayName = 'Google Gemini';
  
  private readonly supportedModels = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-2.0-flash-exp',
  ];
  
  getDefaultModel(): string {
    return 'gemini-1.5-pro';
  }
  
  getSupportedModels(): string[] {
    return [...this.supportedModels];
  }
  
  async fetchAvailableModels(apiKey: string): Promise<string[]> {
    try {
      const response = await fetch(
        `${GOOGLE_API_URL}/models?key=${apiKey}`,
        { method: 'GET' }
      );
      
      if (!response.ok) {
        return this.getSupportedModels();
      }
      
      const data = await response.json() as { models: Array<{ name: string; supportedGenerationMethods: string[] }> };
      
      // Filter to models that support generateContent (chat/text generation)
      const chatModels = data.models
        .filter((model) => 
          model.supportedGenerationMethods?.includes('generateContent') &&
          model.name.includes('gemini')
        )
        .map((model) => model.name.replace('models/', ''))
        .sort((a, b) => {
          // Sort newer models first (2.0 > 1.5 > 1.0)
          const getVersion = (id: string) => {
            if (id.includes('2.0') || id.includes('2-')) return 200;
            if (id.includes('1.5') || id.includes('1-5')) return 150;
            if (id.includes('1.0') || id.includes('1-0')) return 100;
            return 50;
          };
          const versionDiff = getVersion(b) - getVersion(a);
          if (versionDiff !== 0) return versionDiff;
          // Then by capability (pro > flash)
          if (a.includes('pro') && !b.includes('pro')) return -1;
          if (b.includes('pro') && !a.includes('pro')) return 1;
          return a.localeCompare(b);
        });
      
      return chatModels.length > 0 ? chatModels : this.getSupportedModels();
    } catch {
      return this.getSupportedModels();
    }
  }
  
  async testConnection(apiKey: string): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    try {
      // List models endpoint for testing
      const response = await fetch(
        `${GOOGLE_API_URL}/models?key=${apiKey}`,
        { method: 'GET' }
      );
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as GeminiError;
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
    const contents: GeminiContent[] = [];
    let systemInstruction: { parts: Array<{ text: string }> } | undefined;
    
    // Convert messages to Gemini format
    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }
    
    const requestBody: GeminiRequest = { contents };
    
    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }
    
    requestBody.generationConfig = {};
    if (request.maxTokens) {
      requestBody.generationConfig.maxOutputTokens = request.maxTokens;
    }
    if (request.temperature !== undefined) {
      requestBody.generationConfig.temperature = request.temperature;
    }
    
    try {
      const url = `${GOOGLE_API_URL}/models/${request.model}:generateContent?key=${request.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as GeminiError;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(redactApiKey(errorMessage, request.apiKey));
      }
      
      const data = await response.json() as GeminiResponse;
      
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error('No response candidates returned');
      }
      
      const output = candidate.content?.parts?.[0]?.text || '';
      
      return {
        output,
        inputTokens: data.usageMetadata?.promptTokenCount ?? null,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
        totalTokens: data.usageMetadata?.totalTokenCount ?? null,
        tokensEstimated: !data.usageMetadata,
        finishReason: candidate.finishReason,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(redactApiKey(message, request.apiKey));
    }
  }
}
