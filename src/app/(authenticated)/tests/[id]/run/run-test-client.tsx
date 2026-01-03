'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { executeTestRun, RunState } from '@/app/actions/runs';
import { fetchModelsForKey } from '@/app/actions/keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OutputViewer } from '@/components/ui/output-viewer';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { PROVIDER_CONFIGS } from '@/lib/pricing';

interface ModelConfig {
  provider: string;
  model: string;
  apiKeyId: string;
}

interface TestData {
  id: string;
  name: string;
  basePrompt: string;
  variables: string;
}

interface ApiKeyData {
  id: string;
  name: string;
  provider: string;
  keyLastFour: string;
}

interface RunTestClientProps {
  test: TestData;
  keysByProvider: Record<string, ApiKeyData[]>;
}

export function RunTestClient({ test, keysByProvider }: RunTestClientProps) {
  const router = useRouter();
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>(
    JSON.parse(test.variables || '{}')
  );
  const [batchCount, setBatchCount] = useState(1);
  const [isDryRun, setIsDryRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<RunState | null>(null);
  
  // For adding new model configs
  const [newProvider, setNewProvider] = useState('openai');
  const [newModel, setNewModel] = useState('');
  const [newApiKeyId, setNewApiKeyId] = useState('');
  
  // For dynamic model fetching
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const availableProviders = Object.entries(keysByProvider).map(([provider]) => ({
    value: provider,
    label: PROVIDER_CONFIGS[provider]?.displayName || provider,
  }));

  // Fetch models when API key changes
  const loadModelsForKey = useCallback(async (keyId: string) => {
    if (!keyId) {
      setAvailableModels([]);
      return;
    }
    
    setIsLoadingModels(true);
    try {
      const result = await fetchModelsForKey(keyId);
      if (result.success && result.models) {
        setAvailableModels(result.models);
      } else {
        // Fall back to static list from pricing config
        const staticModels = PROVIDER_CONFIGS[newProvider]?.models
          ? Object.keys(PROVIDER_CONFIGS[newProvider].models)
          : [];
        setAvailableModels(staticModels);
      }
    } catch {
      // Fall back to static list
      const staticModels = PROVIDER_CONFIGS[newProvider]?.models
        ? Object.keys(PROVIDER_CONFIGS[newProvider].models)
        : [];
      setAvailableModels(staticModels);
    } finally {
      setIsLoadingModels(false);
    }
  }, [newProvider]);

  useEffect(() => {
    if (newApiKeyId) {
      loadModelsForKey(newApiKeyId);
    }
  }, [newApiKeyId, loadModelsForKey]);

  const handleAddModel = () => {
    if (!newProvider || !newModel || !newApiKeyId) return;
    
    setModelConfigs([...modelConfigs, {
      provider: newProvider,
      model: newModel,
      apiKeyId: newApiKeyId,
    }]);
    
    // Reset
    setNewModel('');
    setNewApiKeyId('');
  };

  const handleRemoveModel = (index: number) => {
    setModelConfigs(modelConfigs.filter((_, i) => i !== index));
  };

  const handleRun = async () => {
    if (modelConfigs.length === 0) return;
    
    setIsRunning(true);
    setResults(null);
    
    try {
      const result = await executeTestRun({
        testId: test.id,
        modelConfigs,
        variables,
        batchCount,
        isDryRun,
      });
      
      setResults(result);
      
      if (result.success && !isDryRun) {
        // Redirect to runs page after successful execution
        router.push(`/tests/${test.id}`);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const keysForProvider = keysByProvider[newProvider] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Run Test: {test.name}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Configure and execute your test
          </p>
        </div>
        <Link href={`/tests/${test.id}`}>
          <Button variant="outline">Back to Test</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Model Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Models</CardTitle>
            <CardDescription>Choose which models to test against</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableProviders.length === 0 ? (
              <p className="text-yellow-600 dark:text-yellow-400">
                No API keys configured.{' '}
                <Link href="/keys" className="underline">Add one first</Link>.
              </p>
            ) : (
              <>
                <div className="grid gap-2 md:grid-cols-3">
                  <Select
                    label="Provider"
                    options={availableProviders}
                    value={newProvider}
                    onChange={(e) => {
                      setNewProvider(e.target.value);
                      setNewApiKeyId('');
                      setNewModel('');
                      setAvailableModels([]);
                    }}
                  />
                  <Select
                    label="API Key"
                    options={[
                      { value: '', label: 'Select key' },
                      ...keysForProvider.map((k) => ({
                        value: k.id,
                        label: `${k.name} (****${k.keyLastFour})`,
                      })),
                    ]}
                    value={newApiKeyId}
                    onChange={(e) => {
                      setNewApiKeyId(e.target.value);
                      setNewModel('');
                    }}
                  />
                  <Select
                    label="Model"
                    options={[
                      { value: '', label: isLoadingModels ? 'Loading models...' : 'Select model' },
                      ...availableModels.map((m) => ({ value: m, label: m })),
                    ]}
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    disabled={!newApiKeyId || isLoadingModels}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleAddModel}
                  disabled={!newProvider || !newModel || !newApiKeyId}
                >
                  Add Model
                </Button>
              </>
            )}

            {/* Selected Models */}
            {modelConfigs.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Selected Models:</h4>
                {modelConfigs.map((mc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md bg-gray-100 px-3 py-2 dark:bg-gray-800"
                  >
                    <span className="text-sm">
                      {mc.provider}/{mc.model}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveModel(i)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variables */}
        <Card>
          <CardHeader>
            <CardTitle>Variables</CardTitle>
            <CardDescription>Override template variables</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(variables).length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No variables defined in this test.
              </p>
            ) : (
              Object.entries(variables).map(([key, value]) => (
                <Input
                  key={key}
                  label={key}
                  value={value}
                  onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Run Options */}
        <Card>
          <CardHeader>
            <CardTitle>Run Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Batch Count"
              type="number"
              min={1}
              max={10}
              value={batchCount}
              onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Number of times to run each model (1-10)
            </p>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isDryRun}
                onChange={(e) => setIsDryRun(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Dry run (estimate cost only, don&apos;t call providers)
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Prompt Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Prompt Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-gray-100 p-3 text-sm dark:bg-gray-800">
              {Object.entries(variables).reduce(
                (prompt, [key, value]) => 
                  prompt.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value),
                test.basePrompt
              )}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>{isDryRun ? 'Dry Run Estimate' : 'Results'}</CardTitle>
          </CardHeader>
          <CardContent>
            {results.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {results.error}
              </div>
            ) : results.results ? (
              <div className="space-y-4">
                {results.results.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-md border p-4 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {r.provider}/{r.model}
                      </span>
                      <Badge
                        variant={
                          r.status === 'completed'
                            ? r.passed === true
                              ? 'success'
                              : r.passed === false
                              ? 'error'
                              : 'info'
                            : r.status === 'failed'
                            ? 'error'
                            : r.status === 'dry_run'
                            ? 'info'
                            : 'warning'
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {r.latencyMs && <span>Latency: {r.latencyMs}ms · </span>}
                      <span>Tokens: {formatNumber(r.inputTokens)} in / {formatNumber(r.outputTokens)} out · </span>
                      <span>Est. Cost: {formatCurrency(r.estimatedCost || 0)}</span>
                    </div>
                    {r.errorMessage && (
                      <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                        Error: {r.errorMessage}
                      </div>
                    )}
                    {r.output && (
                      <div className="mt-3">
                        <OutputViewer output={r.output} maxHeight="400px" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Run Button */}
      <div className="flex justify-end gap-2">
        <Link href={`/tests/${test.id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          onClick={handleRun}
          disabled={modelConfigs.length === 0 || isRunning}
          isLoading={isRunning}
        >
          {isDryRun ? 'Estimate Cost' : `Run Test (${modelConfigs.length} model${modelConfigs.length > 1 ? 's' : ''} × ${batchCount})`}
        </Button>
      </div>
    </div>
  );
}
