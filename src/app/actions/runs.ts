'use server';

/**
 * Run Management Server Actions
 */

import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { runTest, runAdHocPrompt, ModelConfig, RunResult } from '@/lib/test-runner';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const runTestSchema = z.object({
  testId: z.string().min(1),
  modelConfigs: z.array(z.object({
    provider: z.string(),
    model: z.string(),
    apiKeyId: z.string(),
  })).min(1, 'Select at least one model'),
  variables: z.record(z.string()).optional(),
  batchCount: z.number().min(1).max(10).default(1),
  isDryRun: z.boolean().default(false),
});

const runAdHocSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  provider: z.string(),
  model: z.string(),
  apiKeyId: z.string(),
  isDryRun: z.boolean().default(false),
});

export interface RunState {
  error?: string;
  success?: boolean;
  results?: RunResult[];
}

export async function executeTestRun(
  data: z.infer<typeof runTestSchema>
): Promise<RunState> {
  try {
    const { userId } = await requireAuth();

    const validated = runTestSchema.parse(data);

    const results = await runTest({
      testId: validated.testId,
      modelConfigs: validated.modelConfigs as ModelConfig[],
      variables: validated.variables,
      batchCount: validated.batchCount,
      isDryRun: validated.isDryRun,
      userId,
    });

    revalidatePath('/runs');
    revalidatePath(`/tests/${validated.testId}`);
    return { success: true, results };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return { error: 'Please log in to continue' };
      }
      return { error: error.message };
    }
    return { error: 'Failed to run test' };
  }
}

export async function executeAdHocRun(
  data: z.infer<typeof runAdHocSchema>
): Promise<RunState> {
  try {
    const { userId } = await requireAuth();

    const validated = runAdHocSchema.parse(data);

    const result = await runAdHocPrompt(
      userId,
      validated.prompt,
      {
        provider: validated.provider,
        model: validated.model,
        apiKeyId: validated.apiKeyId,
      },
      validated.isDryRun
    );

    revalidatePath('/runs');
    return { success: true, results: [result] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return { error: 'Please log in to continue' };
      }
      return { error: error.message };
    }
    return { error: 'Failed to run prompt' };
  }
}

export async function getRuns(
  options: {
    testId?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { userId } = await requireAuth();
  const { testId, limit = 50, offset = 0 } = options;

  const where: { userId: string; testId?: string } = { userId };
  if (testId) {
    where.testId = testId;
  }

  const [runs, total] = await Promise.all([
    prisma.run.findMany({
      where,
      select: {
        id: true,
        testId: true,
        provider: true,
        model: true,
        prompt: true,
        output: true,
        status: true,
        errorMessage: true,
        latencyMs: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        tokensEstimated: true,
        estimatedCost: true,
        costEstimated: true,
        passed: true,
        validationNotes: true,
        batchId: true,
        isDryRun: true,
        createdAt: true,
        completedAt: true,
        test: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.run.count({ where }),
  ]);

  return { runs, total };
}

export async function getRun(runId: string) {
  const { userId } = await requireAuth();

  const run = await prisma.run.findFirst({
    where: { id: runId, userId },
    include: {
      test: {
        select: {
          id: true,
          name: true,
          expectedContains: true,
          jsonSchema: true,
        },
      },
    },
  });

  return run;
}

export async function deleteRun(runId: string): Promise<RunState> {
  try {
    const { userId } = await requireAuth();

    await prisma.run.deleteMany({
      where: { id: runId, userId },
    });

    revalidatePath('/runs');
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Please log in to continue' };
    }
    return { error: 'Failed to delete run' };
  }
}

export async function getRunsForComparison(testId: string, runsPerModel: number = 5) {
  const { userId } = await requireAuth();

  // Get all runs for this test grouped by provider/model
  const runs = await prisma.run.findMany({
    where: {
      testId,
      userId,
      status: { in: ['completed', 'failed'] },
    },
    select: {
      id: true,
      provider: true,
      model: true,
      output: true,
      status: true,
      latencyMs: true,
      inputTokens: true,
      outputTokens: true,
      estimatedCost: true,
      passed: true,
      validationNotes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group by provider/model and take the latest N
  const grouped: Record<string, typeof runs> = {};
  for (const run of runs) {
    const key = `${run.provider}/${run.model}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    if (grouped[key].length < runsPerModel) {
      grouped[key].push(run);
    }
  }

  return grouped;
}

export async function exportRuns(
  format: 'json' | 'csv',
  testId?: string
): Promise<string> {
  const { userId } = await requireAuth();

  const where: { userId: string; testId?: string } = { userId };
  if (testId) {
    where.testId = testId;
  }

  const runs = await prisma.run.findMany({
    where,
    select: {
      id: true,
      provider: true,
      model: true,
      prompt: true,
      output: true,
      status: true,
      errorMessage: true,
      latencyMs: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      tokensEstimated: true,
      estimatedCost: true,
      costEstimated: true,
      passed: true,
      validationNotes: true,
      isDryRun: true,
      createdAt: true,
      completedAt: true,
      test: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (format === 'json') {
    return JSON.stringify(runs, null, 2);
  }

  // CSV format
  const headers = [
    'ID',
    'Test Name',
    'Provider',
    'Model',
    'Status',
    'Passed',
    'Latency (ms)',
    'Input Tokens',
    'Output Tokens',
    'Est. Cost ($)',
    'Prompt',
    'Output',
    'Error',
    'Created At',
  ];

  const rows = runs.map((run) => [
    run.id,
    run.test?.name || 'Ad-hoc',
    run.provider,
    run.model,
    run.status,
    run.passed === null ? '' : run.passed ? 'Yes' : 'No',
    run.latencyMs?.toString() || '',
    run.inputTokens?.toString() || '',
    run.outputTokens?.toString() || '',
    run.estimatedCost?.toFixed(6) || '',
    `"${(run.prompt || '').replace(/"/g, '""')}"`,
    `"${(run.output || '').replace(/"/g, '""')}"`,
    `"${(run.errorMessage || '').replace(/"/g, '""')}"`,
    run.createdAt.toISOString(),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Rerun a previous run with the same configuration
 */
export async function rerunFromRun(runId: string): Promise<RunState> {
  try {
    const { userId } = await requireAuth();

    // Get the original run
    const originalRun = await prisma.run.findFirst({
      where: { id: runId, userId },
      include: {
        test: true,
        apiKey: {
          select: { id: true, isActive: true },
        },
      },
    });

    if (!originalRun) {
      return { error: 'Run not found' };
    }

    if (!originalRun.apiKey?.isActive) {
      return { error: 'The API key used for this run is no longer active' };
    }

    if (!originalRun.testId || !originalRun.test) {
      return { error: 'Cannot rerun ad-hoc prompts from here' };
    }

    // Execute the test with the same model config
    const results = await runTest({
      testId: originalRun.testId,
      modelConfigs: [{
        provider: originalRun.provider,
        model: originalRun.model,
        apiKeyId: originalRun.apiKeyId,
      }],
      variables: originalRun.variables ? JSON.parse(originalRun.variables) : undefined,
      batchCount: 1,
      isDryRun: false,
      userId,
    });

    revalidatePath('/runs');
    revalidatePath(`/tests/${originalRun.testId}`);
    return { success: true, results };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return { error: 'Please log in to continue' };
      }
      return { error: error.message };
    }
    return { error: 'Failed to rerun test' };
  }
}
