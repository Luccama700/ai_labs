'use client';

import { useState } from 'react';
import Link from 'next/link';
import { rerunFromRun } from '@/app/actions/runs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/utils';

interface Run {
  id: string;
  provider: string;
  model: string;
  status: string;
  passed: boolean | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  createdAt: Date;
}

interface RecentRunsTableProps {
  runs: Run[];
  testId: string;
}

export function RecentRunsTable({ runs, testId }: RecentRunsTableProps) {
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [rerunningAll, setRerunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRerun = async (runId: string) => {
    setRerunningId(runId);
    setError(null);
    
    try {
      const result = await rerunFromRun(runId);
      if (result.error) {
        setError(result.error);
      }
      // Page will be revalidated automatically
    } catch (err) {
      setError('Failed to rerun test');
    } finally {
      setRerunningId(null);
    }
  };

  const handleRerunAll = async () => {
    // Get unique model configurations (dedupe by provider+model)
    const uniqueRuns = new Map<string, Run>();
    for (const run of runs) {
      const key = `${run.provider}/${run.model}`;
      if (!uniqueRuns.has(key)) {
        uniqueRuns.set(key, run);
      }
    }

    setRerunningAll(true);
    setError(null);

    try {
      // Run all in sequence to avoid rate limits
      for (const run of uniqueRuns.values()) {
        const result = await rerunFromRun(run.id);
        if (result.error) {
          setError(`Failed to rerun ${run.provider}/${run.model}: ${result.error}`);
          break;
        }
      }
    } catch (err) {
      setError('Failed to rerun all tests');
    } finally {
      setRerunningAll(false);
    }
  };

  if (runs.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
        No runs yet.{' '}
        <Link href={`/tests/${testId}/run`} className="text-blue-600 hover:underline dark:text-blue-400">
          Run this test
        </Link>{' '}
        to see results.
      </p>
    );
  }

  // Count unique models
  const uniqueModels = new Set(runs.map(r => `${r.provider}/${r.model}`)).size;

  return (
    <div className="space-y-3">
      {/* Rerun All Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRerunAll}
          isLoading={rerunningAll}
          disabled={rerunningId !== null || rerunningAll}
        >
          Rerun All ({uniqueModels} model{uniqueModels !== 1 ? 's' : ''})
        </Button>
      </div>
      
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Time</th>
              <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Model</th>
              <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Latency</th>
              <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Tokens</th>
              <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Cost</th>
              <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b dark:border-gray-700">
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatRelativeTime(run.createdAt)}
                </td>
                <td className="py-2 text-gray-900 dark:text-white">
                  {run.provider}/{run.model}
                </td>
                <td className="py-2">
                  <Badge
                    variant={
                      run.status === 'completed'
                        ? run.passed === true
                          ? 'success'
                          : run.passed === false
                          ? 'error'
                          : 'info'
                        : run.status === 'failed'
                        ? 'error'
                        : 'warning'
                    }
                  >
                    {run.status}
                    {run.passed !== null && ` (${run.passed ? 'Pass' : 'Fail'})`}
                  </Badge>
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {run.latencyMs ? `${run.latencyMs}ms` : '-'}
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatNumber(run.inputTokens)} / {formatNumber(run.outputTokens)}
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {run.estimatedCost ? formatCurrency(run.estimatedCost) : '-'}
                </td>
                <td className="py-2">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRerun(run.id)}
                      isLoading={rerunningId === run.id}
                      disabled={rerunningId !== null}
                    >
                      Rerun
                    </Button>
                    <Link href={`/runs/${run.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
