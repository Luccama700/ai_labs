'use client';

import { useState } from 'react';
import Link from 'next/link';
import { deleteRun } from '@/app/actions/runs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber, formatDate, formatRelativeTime } from '@/lib/utils';

interface Run {
  id: string;
  testId: string | null;
  provider: string;
  model: string;
  prompt: string;
  output: string | null;
  status: string;
  errorMessage: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  tokensEstimated: boolean;
  estimatedCost: number | null;
  costEstimated: boolean;
  passed: boolean | null;
  validationNotes: string | null;
  batchId: string | null;
  isDryRun: boolean;
  createdAt: Date;
  completedAt: Date | null;
  test: { name: string } | null;
}

interface RunsClientProps {
  initialRuns: Run[];
  total: number;
}

export function RunsClient({ initialRuns, total }: RunsClientProps) {
  const [runs, setRuns] = useState(initialRuns);

  const handleDelete = async (runId: string) => {
    if (!confirm('Are you sure you want to delete this run?')) return;
    
    const result = await deleteRun(runId);
    if (result.success) {
      setRuns(runs.filter((r) => r.id !== runId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Runs</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {total} total run{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/tests">
          <Button>Run a Test</Button>
        </Link>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No runs yet.{' '}
              <Link href="/tests" className="text-blue-600 hover:underline dark:text-blue-400">
                Create a test
              </Link>{' '}
              to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Run History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">Time</th>
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">Test</th>
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">Provider/Model</th>
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">Latency</th>
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">Input</th>
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">Output</th>
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">Cost</th>
                    <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3">
                        <div className="text-gray-900 dark:text-white" title={formatDate(run.createdAt)}>
                          {formatRelativeTime(run.createdAt)}
                        </div>
                      </td>
                      <td className="py-3">
                        {run.test ? (
                          <Link
                            href={`/tests/${run.testId}`}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {run.test.name}
                          </Link>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">Ad-hoc</span>
                        )}
                      </td>
                      <td className="py-3 text-gray-900 dark:text-white">
                        {run.provider}/{run.model}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={
                              run.status === 'completed'
                                ? 'success'
                                : run.status === 'failed'
                                ? 'error'
                                : run.status === 'dry_run'
                                ? 'info'
                                : 'warning'
                            }
                          >
                            {run.isDryRun ? 'Dry Run' : run.status}
                          </Badge>
                          {run.passed !== null && (
                            <Badge variant={run.passed ? 'success' : 'error'}>
                              {run.passed ? 'Pass' : 'Fail'}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-300">
                        {run.latencyMs ? `${run.latencyMs}ms` : '-'}
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-300">
                        {formatNumber(run.inputTokens)}
                        {run.tokensEstimated && run.inputTokens && ' *'}
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-300">
                        {formatNumber(run.outputTokens)}
                        {run.tokensEstimated && run.outputTokens && ' *'}
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-300">
                        {run.estimatedCost ? formatCurrency(run.estimatedCost) : '-'}
                        {run.costEstimated && run.estimatedCost && ' *'}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Link href={`/runs/${run.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(run.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              * = estimated (not from provider)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
