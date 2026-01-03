'use server';

/**
 * API Key Management Server Actions
 */

import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { encryptApiKey, decryptApiKey, getKeyLastFour } from '@/lib/encryption';
import { getAdapter } from '@/lib/providers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  provider: z.enum(['openai', 'anthropic', 'google', 'deepseek', 'local']),
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url().optional().or(z.literal('')),
});

export interface KeyState {
  error?: string;
  success?: boolean;
}

export async function createApiKey(
  _prevState: KeyState,
  formData: FormData
): Promise<KeyState> {
  try {
    const { userId } = await requireAuth();

    const data = createKeySchema.parse({
      name: formData.get('name'),
      provider: formData.get('provider'),
      apiKey: formData.get('apiKey'),
      baseUrl: formData.get('baseUrl') || undefined,
    });

    // Encrypt the API key
    const encrypted = encryptApiKey(data.apiKey);
    const keyLastFour = getKeyLastFour(data.apiKey);

    await prisma.apiKey.create({
      data: {
        userId,
        name: data.name,
        provider: data.provider,
        encryptedKey: encrypted.encryptedKey,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyLastFour,
        baseUrl: data.baseUrl || null,
      },
    });

    revalidatePath('/keys');
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Please log in to continue' };
    }
    return { error: 'Failed to create API key' };
  }
}

export async function testApiKey(keyId: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  try {
    const { userId } = await requireAuth();

    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      return { success: false, message: 'API key not found' };
    }

    // Decrypt the key
    const decryptedKey = decryptApiKey({
      encryptedKey: apiKey.encryptedKey,
      iv: apiKey.iv,
      authTag: apiKey.authTag,
    });

    // Get the provider adapter
    const adapter = getAdapter(apiKey.provider);
    if (!adapter) {
      return { success: false, message: `Provider ${apiKey.provider} not found` };
    }

    // Test connection
    const result = await adapter.testConnection(decryptedKey, apiKey.baseUrl || undefined);

    // Update last tested timestamp
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { lastTestedAt: new Date() },
    });

    return {
      success: result.success,
      message: result.message,
      latencyMs: result.latencyMs,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { success: false, message: 'Please log in to continue' };
    }
    return { success: false, message: 'Failed to test API key' };
  }
}

export async function deleteApiKey(keyId: string): Promise<KeyState> {
  try {
    const { userId } = await requireAuth();

    await prisma.apiKey.deleteMany({
      where: { id: keyId, userId },
    });

    revalidatePath('/keys');
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Please log in to continue' };
    }
    return { error: 'Failed to delete API key' };
  }
}

export async function toggleApiKeyActive(keyId: string): Promise<KeyState> {
  try {
    const { userId } = await requireAuth();

    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      return { error: 'API key not found' };
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: !apiKey.isActive },
    });

    revalidatePath('/keys');
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Please log in to continue' };
    }
    return { error: 'Failed to update API key' };
  }
}

export async function getApiKeys() {
  const { userId } = await requireAuth();

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      provider: true,
      keyLastFour: true,
      baseUrl: true,
      isActive: true,
      lastTestedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return keys;
}

export async function getActiveKeysByProvider() {
  const { userId } = await requireAuth();

  const keys = await prisma.apiKey.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      name: true,
      provider: true,
      keyLastFour: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group by provider
  const byProvider: Record<string, typeof keys> = {};
  for (const key of keys) {
    if (!byProvider[key.provider]) {
      byProvider[key.provider] = [];
    }
    byProvider[key.provider].push(key);
  }

  return byProvider;
}

/**
 * Fetch available models for a specific API key
 * This queries the provider's API to get the actual list of models available
 */
export async function fetchModelsForKey(keyId: string): Promise<{ success: boolean; models?: string[]; error?: string }> {
  try {
    const { userId } = await requireAuth();

    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    const adapter = getAdapter(apiKey.provider);
    if (!adapter) {
      return { success: false, error: `Unknown provider: ${apiKey.provider}` };
    }

    // Decrypt the API key
    const decryptedKey = decryptApiKey({
      encryptedKey: apiKey.encryptedKey,
      iv: apiKey.iv,
      authTag: apiKey.authTag,
    });

    // Fetch available models from the provider
    const models = await adapter.fetchAvailableModels(decryptedKey, apiKey.baseUrl || undefined);

    return { success: true, models };
  } catch (error) {
    console.error('Error fetching models:', error);
    return { success: false, error: 'Failed to fetch models' };
  }
}
