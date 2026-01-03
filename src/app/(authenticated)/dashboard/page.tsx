import Link from 'next/link';
import { getApiKeys } from '@/app/actions/keys';
import { getTests } from '@/app/actions/tests';
import { getRuns } from '@/app/actions/runs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

export default async function DashboardPage() {
  const [apiKeys, tests, { runs, total: runCount }] = await Promise.all([
    getApiKeys(),
    getTests(),
    getRuns({ limit: 5 }),
  ]);

  const activeKeys = apiKeys.filter((k) => k.isActive).length;
  const recentRuns = runs.slice(0, 5);
  const totalCost = runs.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Overview of your AI testing lab
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{activeKeys}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Active API Keys</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{tests.length}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Saved Tests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{runCount}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCost)}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Est. Total Cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Link href="/keys">
            <Button variant="outline">Add API Key</Button>
          </Link>
          <Link href="/tests/new">
            <Button variant="outline">Create Test</Button>
          </Link>
          <Link href="/runs">
            <Button variant="outline">View All Runs</Button>
          </Link>
          <Link href="/compare">
            <Button variant="outline">Compare Models</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>Your latest test executions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No runs yet.{' '}
              <Link href="/tests" className="text-blue-600 hover:underline dark:text-blue-400">
                Create a test
              </Link>{' '}
              to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {run.test?.name || 'Ad-hoc run'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {run.provider}/{run.model}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
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
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(run.createdAt)}
                    </div>
                    <Link href={`/runs/${run.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys Status */}
      {apiKeys.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="py-6">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">No API Keys Configured</h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              Add an API key to start running tests against AI models.
            </p>
            <Link href="/keys" className="mt-4 inline-block">
              <Button>Add API Key</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
