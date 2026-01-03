/**
 * Provider Router
 * Central registry and router for all provider adapters
 */

import { ProviderAdapter } from './types';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';
import { DeepSeekAdapter } from './deepseek';
import { LocalAdapter } from './local';

// Singleton instances of adapters
const adapters: Map<string, ProviderAdapter> = new Map();

// Initialize adapters
function initAdapters() {
  if (adapters.size === 0) {
    const openai = new OpenAIAdapter();
    const anthropic = new AnthropicAdapter();
    const google = new GoogleAdapter();
    const deepseek = new DeepSeekAdapter();
    const local = new LocalAdapter();
    
    adapters.set(openai.name, openai);
    adapters.set(anthropic.name, anthropic);
    adapters.set(google.name, google);
    adapters.set(deepseek.name, deepseek);
    adapters.set(local.name, local);
  }
}

/**
 * Get an adapter by provider name
 */
export function getAdapter(providerName: string): ProviderAdapter | null {
  initAdapters();
  return adapters.get(providerName) || null;
}

/**
 * Get all registered adapters
 */
export function getAllAdapters(): ProviderAdapter[] {
  initAdapters();
  return Array.from(adapters.values());
}

/**
 * Get all provider names
 */
export function getProviderNames(): string[] {
  initAdapters();
  return Array.from(adapters.keys());
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(providerName: string): boolean {
  initAdapters();
  return adapters.has(providerName);
}

/**
 * Register a custom adapter (for extensibility)
 */
export function registerAdapter(adapter: ProviderAdapter): void {
  initAdapters();
  adapters.set(adapter.name, adapter);
}

// Re-export types
export * from './types';
