'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRunsForComparison } from '@/app/actions/runs';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/utils';

interface Test {
  id: string;
  name: string;
}

interface Run {
  id: string;
  provider: string;
  model: string;
  output: string | null;
  status: string;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  passed: boolean | null;
  validationNotes: string | null;
  createdAt: Date;
}

interface CompareClientProps {
  tests: Test[];
}

export function CompareClient({ tests }: CompareClientProps) {
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [runsByModel, setRunsByModel] = useState<Record<string, Run[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedTestId) {
      loadComparison();
    }
  }, [selectedTestId]);

  const loadComparison = async () => {
    if (!selectedTestId) return;
    
    setIsLoading(true);
    try {
      const data = await getRunsForComparison(selectedTestId, 5);
      setRunsByModel(data);
    } finally {
      setIsLoading(false);
    }
  };

  const models = Object.keys(runsByModel);
  const hasRuns = models.length > 0;

  // Calculate aggregate stats
  const modelStats = models.map((modelKey) => {
    const runs = runsByModel[modelKey];
    const completedRuns = runs.filter((r) => r.status === 'completed');
    const passedRuns = runs.filter((r) => r.passed === true);
    const avgLatency = completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / completedRuns.length
      : null;
    const totalCost = runs.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);
    
    return {
      modelKey,
      provider: runs[0]?.provider || '',
      model: runs[0]?.model || '',
      runCount: runs.length,
      completedCount: completedRuns.length,
      passRate: completedRuns.length > 0 
        ? (passedRuns.length / completedRuns.length) * 100 
        : null,
      avgLatency,
      totalCost,
      runs,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compare Models</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Compare outputs and metrics across different models
          </p>
        </div>
      </div>

      {/* Test Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Test</CardTitle>
          <CardDescription>Choose a test to compare model results</CardDescription>
        </CardHeader>
        <CardContent>
          {tests.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No tests available.{' '}
              <Link href="/tests/new" className="text-blue-600 hover:underline dark:text-blue-400">
                Create a test
              </Link>{' '}
              first.
            </p>
          ) : (
            <Select
              options={[
                { value: '', label: 'Select a test...' },
                ...tests.map((t) => ({ value: t.id, label: t.name })),
              ]}
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
            />
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading comparison data...</p>
        </div>
      ) : selectedTestId && !hasRuns ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No runs found for this test.{' '}
              <Link href={`/tests/${selectedTestId}/run`} className="text-blue-600 hover:underline dark:text-blue-400">
                Run this test
              </Link>{' '}
              against some models first.
            </p>
          </CardContent>
        </Card>
      ) : hasRuns ? (
        <>
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Model Comparison Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Model</th>
                      <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Runs</th>
                      <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Pass Rate</th>
                      <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Avg Latency</th>
                      <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelStats.map((stat) => (
                      <tr key={stat.modelKey} className="border-b dark:border-gray-700">
                        <td className="py-2 font-medium text-gray-900 dark:text-white">
                          {stat.provider}/{stat.model}
                        </td>
                        <td className="py-2 text-gray-600 dark:text-gray-300">
                          {stat.completedCount}/{stat.runCount}
                        </td>
                        <td className="py-2">
                          {stat.passRate !== null ? (
                            <Badge variant={stat.passRate >= 80 ? 'success' : stat.passRate >= 50 ? 'warning' : 'error'}>
                              {stat.passRate.toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-600 dark:text-gray-300">
                          {stat.avgLatency ? `${stat.avgLatency.toFixed(0)}ms` : '-'}
                        </td>
                        <td className="py-2 text-gray-600 dark:text-gray-300">
                          {formatCurrency(stat.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Side-by-Side Output Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Output Comparison</CardTitle>
              <CardDescription>Latest outputs from each model</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modelStats.map((stat) => {
                  const latestRun = stat.runs[0];
                  if (!latestRun) return null;
                  
                  return (
                    <div key={stat.modelKey} className="border rounded-lg p-4 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {stat.provider}/{stat.model}
                        </span>
                        <div className="flex gap-1">
                          <Badge
                            variant={
                              latestRun.status === 'completed'
                                ? latestRun.passed === true
                                  ? 'success'
                                  : latestRun.passed === false
                                  ? 'error'
                                  : 'info'
                                : 'error'
                            }
                          >
                            {latestRun.passed === true ? 'Pass' : latestRun.passed === false ? 'Fail' : latestRun.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        {formatRelativeTime(latestRun.createdAt)} •{' '}
                        {latestRun.latencyMs ? `${latestRun.latencyMs}ms` : '-'} •{' '}
                        {formatNumber(latestRun.outputTokens)} tokens
                      </div>
                      <div className="max-h-48 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">
                        <pre className="whitespace-pre-wrap">
                          {latestRun.output || latestRun.status}
                        </pre>
                      </div>
                      <div className="mt-2">
                        <Link href={`/runs/${latestRun.id}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
