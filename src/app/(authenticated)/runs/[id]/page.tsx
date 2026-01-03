import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRun } from '@/app/actions/runs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OutputViewer } from '@/components/ui/output-viewer';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';

interface RunPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunPage({ params }: RunPageProps) {
  const { id } = await params;
  const run = await getRun(id);

  if (!run) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Run Details
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {run.provider}/{run.model} • {formatDate(run.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {run.test && (
            <Link href={`/tests/${run.test.id}`}>
              <Button variant="outline">View Test</Button>
            </Link>
          )}
          <Link href="/runs">
            <Button variant="outline">Back to Runs</Button>
          </Link>
        </div>
      </div>

      {/* Status Summary */}
      <div className="flex flex-wrap gap-2">
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
            {run.passed ? 'Passed' : 'Failed'}
          </Badge>
        )}
        {run.tokensEstimated && (
          <Badge variant="warning">Tokens Estimated</Badge>
        )}
        {run.costEstimated && (
          <Badge variant="warning">Cost Estimated</Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Latency</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {run.latencyMs ? `${run.latencyMs}ms` : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Input Tokens</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatNumber(run.inputTokens)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Output Tokens</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatNumber(run.outputTokens)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Total Tokens</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatNumber(run.totalTokens)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Estimated Cost</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {run.estimatedCost ? formatCurrency(run.estimatedCost) : '-'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Validation */}
        <Card>
          <CardHeader>
            <CardTitle>Validation</CardTitle>
          </CardHeader>
          <CardContent>
            {run.passed === null ? (
              <p className="text-gray-500 dark:text-gray-400">
                No validation rules were configured for this test.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={run.passed ? 'text-green-600' : 'text-red-600'}>
                    {run.passed ? '✓' : '✗'}
                  </span>
                  <span className="font-medium">
                    {run.passed ? 'All validations passed' : 'Validation failed'}
                  </span>
                </div>
                {run.validationNotes && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {run.validationNotes}
                  </p>
                )}
                {run.test?.expectedContains && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Expected Contains
                    </h4>
                    <p className="mt-1 text-sm">{run.test.expectedContains}</p>
                  </div>
                )}
                {run.test?.jsonSchema && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      JSON Schema
                    </h4>
                    <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800">
                      {JSON.stringify(JSON.parse(run.test.jsonSchema), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prompt */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-gray-100 p-4 text-sm dark:bg-gray-800">
              {run.prompt}
            </pre>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Output</CardTitle>
          </CardHeader>
          <CardContent>
            {run.errorMessage ? (
              <div className="rounded-md bg-red-50 p-4 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <h4 className="font-medium">Error</h4>
                <p className="mt-1">{run.errorMessage}</p>
              </div>
            ) : run.output ? (
              <OutputViewer output={run.output} maxHeight="600px" />
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No output</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
