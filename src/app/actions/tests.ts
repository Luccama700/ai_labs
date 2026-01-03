'use server';

/**
 * Test Management Server Actions
 */

import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createTestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  basePrompt: z.string().min(1, 'Prompt is required'),
  variables: z.string().optional(),
  modelConfigs: z.string().optional(),
  expectedContains: z.string().optional(),
  jsonSchema: z.string().optional(),
});

const updateTestSchema = createTestSchema.extend({
  id: z.string().min(1),
});

export interface TestState {
  error?: string;
  success?: boolean;
  testId?: string;
}

export async function createTest(
  _prevState: TestState,
  formData: FormData
): Promise<TestState> {
  try {
    const { userId } = await requireAuth();

    const data = createTestSchema.parse({
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      basePrompt: formData.get('basePrompt'),
      variables: formData.get('variables') || '{}',
      modelConfigs: formData.get('modelConfigs') || '[]',
      expectedContains: formData.get('expectedContains') || undefined,
      jsonSchema: formData.get('jsonSchema') || undefined,
    });

    // Validate JSON fields
    try {
      JSON.parse(data.variables || '{}');
    } catch {
      return { error: 'Invalid variables JSON' };
    }

    try {
      JSON.parse(data.modelConfigs || '[]');
    } catch {
      return { error: 'Invalid model configurations JSON' };
    }

    if (data.jsonSchema) {
      try {
        JSON.parse(data.jsonSchema);
      } catch {
        return { error: 'Invalid JSON schema' };
      }
    }

    const test = await prisma.test.create({
      data: {
        userId,
        name: data.name,
        description: data.description || null,
        basePrompt: data.basePrompt,
        variables: data.variables || '{}',
        modelConfigs: data.modelConfigs || '[]',
        expectedContains: data.expectedContains || null,
        jsonSchema: data.jsonSchema || null,
      },
    });

    revalidatePath('/tests');
    return { success: true, testId: test.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Please log in to continue' };
    }
    return { error: 'Failed to create test' };
  }
}

export async function updateTest(
  _prevState: TestState,
  formData: FormData
): Promise<TestState> {
  try {
    const { userId } = await requireAuth();

    const data = updateTestSchema.parse({
      id: formData.get('id'),
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      basePrompt: formData.get('basePrompt'),
      variables: formData.get('variables') || '{}',
      modelConfigs: formData.get('modelConfigs') || '[]',
      expectedContains: formData.get('expectedContains') || undefined,
      jsonSchema: formData.get('jsonSchema') || undefined,
    });

    // Verify ownership
    const existing = await prisma.test.findFirst({
      where: { id: data.id, userId },
    });

    if (!existing) {
      return { error: 'Test not found' };
    }

    await prisma.test.update({
      where: { id: data.id },
      data: {
        name: data.name,
        description: data.description || null,
        basePrompt: data.basePrompt,
        variables: data.variables || '{}',
        modelConfigs: data.modelConfigs || '[]',
        expectedContains: data.expectedContains || null,
        jsonSchema: data.jsonSchema || null,
      },
    });

    revalidatePath('/tests');
    revalidatePath(`/tests/${data.id}`);
    return { success: true, testId: data.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Please log in to continue' };
    }
    return { error: 'Failed to update test' };
  }
}

export async function deleteTest(testId: string): Promise<TestState> {
  try {
    const { userId } = await requireAuth();

    await prisma.test.deleteMany({
      where: { id: testId, userId },
    });

    revalidatePath('/tests');
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Please log in to continue' };
    }
    return { error: 'Failed to delete test' };
  }
}

export async function getTests() {
  const { userId } = await requireAuth();

  const tests = await prisma.test.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      basePrompt: true,
      variables: true,
      modelConfigs: true,
      expectedContains: true,
      jsonSchema: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { runs: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return tests;
}

export async function getTest(testId: string) {
  const { userId } = await requireAuth();

  const test = await prisma.test.findFirst({
    where: { id: testId, userId },
    include: {
      runs: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          provider: true,
          model: true,
          status: true,
          latencyMs: true,
          inputTokens: true,
          outputTokens: true,
          estimatedCost: true,
          passed: true,
          createdAt: true,
        },
      },
    },
  });

  return test;
}
