/**
 * Test Runner
 * Executes tests against provider models with batching support
 */

import prisma from './db';
import { getAdapter, ProviderMessage } from './providers';
import { decryptApiKey } from './encryption';
import { calculateCost, estimateTokenCount } from './pricing';
import { validateOutput } from './validation';
import { checkRateLimit } from './rate-limit';

export interface ModelConfig {
  provider: string;
  model: string;
  apiKeyId: string;
}

export interface RunOptions {
  testId: string;
  modelConfigs: ModelConfig[];
  variables?: Record<string, string>;
  batchCount?: number; // Number of times to run each model
  isDryRun?: boolean;
  userId: string;
}

export interface RunResult {
  id: string;
  status: 'completed' | 'failed' | 'dry_run';
  provider: string;
  model: string;
  output?: string;
  errorMessage?: string;
  latencyMs?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number;
  passed?: boolean | null;
  validationNotes?: string;
}

/**
 * Substitute variables in a prompt template
 * Variables are in {{variableName}} format
 */
function substituteVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * Execute a single run
 */
async function executeRun(
  runId: string,
  prompt: string,
  modelConfig: ModelConfig,
  apiKey: { encryptedKey: string; iv: string; authTag: string; baseUrl: string | null },
  expectedContains: string | null,
  jsonSchema: string | null,
  isDryRun: boolean
): Promise<RunResult> {
  const startTime = Date.now();
  
  // Update run status to running
  await prisma.run.update({
    where: { id: runId },
    data: { status: 'running' },
  });
  
  if (isDryRun) {
    // Estimate tokens and cost without calling provider
    const inputTokens = estimateTokenCount(prompt);
    const outputTokens = estimateTokenCount(''); // Estimate average output ~500 tokens
    const { cost } = calculateCost(modelConfig.provider, modelConfig.model, inputTokens, 500);
    
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'dry_run',
        inputTokens,
        outputTokens: null,
        estimatedCost: cost,
        tokensEstimated: true,
        costEstimated: true,
        isDryRun: true,
        completedAt: new Date(),
      },
    });
    
    return {
      id: runId,
      status: 'dry_run',
      provider: modelConfig.provider,
      model: modelConfig.model,
      inputTokens,
      estimatedCost: cost,
    };
  }
  
  try {
    // Decrypt API key
    const decryptedKey = decryptApiKey({
      encryptedKey: apiKey.encryptedKey,
      iv: apiKey.iv,
      authTag: apiKey.authTag,
    });
    
    // Get provider adapter
    const adapter = getAdapter(modelConfig.provider);
    if (!adapter) {
      throw new Error(`Provider ${modelConfig.provider} not found`);
    }
    
    // Build messages
    const messages: ProviderMessage[] = [
      { role: 'user', content: prompt },
    ];
    
    // Execute completion
    const response = await adapter.complete({
      messages,
      model: modelConfig.model,
      apiKey: decryptedKey,
      baseUrl: apiKey.baseUrl || undefined,
    });
    
    const latencyMs = Date.now() - startTime;
    
    // Calculate tokens (use estimates if not provided)
    const inputTokens = response.inputTokens ?? estimateTokenCount(prompt);
    const outputTokens = response.outputTokens ?? estimateTokenCount(response.output);
    const tokensEstimated = response.tokensEstimated || response.inputTokens === null;
    
    // Calculate cost
    const { cost, isEstimated: costEstimated } = calculateCost(
      modelConfig.provider,
      modelConfig.model,
      inputTokens,
      outputTokens
    );
    
    // Validate output
    const validation = validateOutput(response.output, expectedContains, jsonSchema);
    
    // Update run record
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'completed',
        output: response.output,
        latencyMs,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        tokensEstimated,
        estimatedCost: cost,
        costEstimated,
        passed: validation?.passed ?? null,
        validationNotes: validation?.notes ?? null,
        completedAt: new Date(),
      },
    });
    
    return {
      id: runId,
      status: 'completed',
      provider: modelConfig.provider,
      model: modelConfig.model,
      output: response.output,
      latencyMs,
      inputTokens,
      outputTokens,
      estimatedCost: cost,
      passed: validation?.passed ?? null,
      validationNotes: validation?.notes ?? undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const latencyMs = Date.now() - startTime;
    
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'failed',
        errorMessage,
        latencyMs,
        completedAt: new Date(),
      },
    });
    
    return {
      id: runId,
      status: 'failed',
      provider: modelConfig.provider,
      model: modelConfig.model,
      errorMessage,
      latencyMs,
    };
  }
}

/**
 * Run a test against multiple models with optional batching
 */
export async function runTest(options: RunOptions): Promise<RunResult[]> {
  const { testId, modelConfigs, variables = {}, batchCount = 1, isDryRun = false, userId } = options;
  
  // Check rate limit
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    throw new Error('Rate limit exceeded. Please wait a minute before running more tests.');
  }
  
  // Fetch the test
  const test = await prisma.test.findUnique({
    where: { id: testId },
  });
  
  if (!test || test.userId !== userId) {
    throw new Error('Test not found');
  }
  
  // Parse test variables and merge with provided variables
  const testVariables = JSON.parse(test.variables || '{}');
  const mergedVariables = { ...testVariables, ...variables };
  
  // Substitute variables in prompt
  const prompt = substituteVariables(test.basePrompt, mergedVariables);
  
  // Generate batch ID for grouping runs
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Fetch API keys for all model configs
  const apiKeyIds = [...new Set(modelConfigs.map((mc) => mc.apiKeyId))];
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      id: { in: apiKeyIds },
      userId,
      isActive: true,
    },
  });
  
  const apiKeyMap = new Map(apiKeys.map((k) => [k.id, k]));
  
  const results: RunResult[] = [];
  let batchIndex = 0;
  
  // Execute runs
  for (let i = 0; i < batchCount; i++) {
    for (const modelConfig of modelConfigs) {
      // Re-check rate limit for each run
      if (!isDryRun) {
        const check = await checkRateLimit(userId);
        if (!check.allowed) {
          throw new Error(`Rate limit exceeded after ${results.length} runs. Results so far have been saved.`);
        }
      }
      
      const apiKey = apiKeyMap.get(modelConfig.apiKeyId);
      if (!apiKey) {
        results.push({
          id: '',
          status: 'failed',
          provider: modelConfig.provider,
          model: modelConfig.model,
          errorMessage: 'API key not found or inactive',
        });
        continue;
      }
      
      // Create run record
      const run = await prisma.run.create({
        data: {
          userId,
          testId,
          apiKeyId: modelConfig.apiKeyId,
          provider: modelConfig.provider,
          model: modelConfig.model,
          prompt,
          inputVariables: JSON.stringify(mergedVariables),
          status: 'pending',
          batchId,
          batchIndex: batchIndex++,
          isDryRun,
        },
      });
      
      const result = await executeRun(
        run.id,
        prompt,
        modelConfig,
        {
          encryptedKey: apiKey.encryptedKey,
          iv: apiKey.iv,
          authTag: apiKey.authTag,
          baseUrl: apiKey.baseUrl,
        },
        test.expectedContains,
        test.jsonSchema,
        isDryRun
      );
      
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Run a single ad-hoc prompt (not from a saved test)
 */
export async function runAdHocPrompt(
  userId: string,
  prompt: string,
  modelConfig: ModelConfig,
  isDryRun: boolean = false
): Promise<RunResult> {
  // Check rate limit
  if (!isDryRun) {
    const rateCheck = await checkRateLimit(userId);
    if (!rateCheck.allowed) {
      throw new Error('Rate limit exceeded. Please wait a minute before running more tests.');
    }
  }
  
  // Fetch API key
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: modelConfig.apiKeyId,
      userId,
      isActive: true,
    },
  });
  
  if (!apiKey) {
    return {
      id: '',
      status: 'failed',
      provider: modelConfig.provider,
      model: modelConfig.model,
      errorMessage: 'API key not found or inactive',
    };
  }
  
  // Create run record
  const run = await prisma.run.create({
    data: {
      userId,
      testId: null, // Ad-hoc run
      apiKeyId: modelConfig.apiKeyId,
      provider: modelConfig.provider,
      model: modelConfig.model,
      prompt,
      inputVariables: '{}',
      status: 'pending',
      isDryRun,
    },
  });
  
  return executeRun(
    run.id,
    prompt,
    modelConfig,
    {
      encryptedKey: apiKey.encryptedKey,
      iv: apiKey.iv,
      authTag: apiKey.authTag,
      baseUrl: apiKey.baseUrl,
    },
    null,
    null,
    isDryRun
  );
}
