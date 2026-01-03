import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTest } from '@/app/actions/tests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RecentRunsTable } from '@/components/recent-runs-table';

interface TestPageProps {
  params: Promise<{ id: string }>;
}

export default async function TestPage({ params }: TestPageProps) {
  const { id } = await params;
  const test = await getTest(id);

  if (!test) {
    notFound();
  }

  const variables = JSON.parse(test.variables || '{}');
  const modelConfigs = JSON.parse(test.modelConfigs || '[]');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{test.name}</h1>
          {test.description && (
            <p className="mt-1 text-gray-500 dark:text-gray-400">{test.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/tests/${test.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Link href={`/tests/${test.id}/run`}>
            <Button>Run Test</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Test Details */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Prompt</h4>
              <pre className="mt-1 whitespace-pre-wrap rounded-md bg-gray-100 p-3 text-sm dark:bg-gray-800">
                {test.basePrompt}
              </pre>
            </div>
            
            {Object.keys(variables).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Variables</h4>
                <pre className="mt-1 rounded-md bg-gray-100 p-3 text-sm dark:bg-gray-800">
                  {JSON.stringify(variables, null, 2)}
                </pre>
              </div>
            )}
            
            {modelConfigs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Model Configurations</h4>
                <div className="mt-1 flex flex-wrap gap-2">
                  {modelConfigs.map((mc: { provider: string; model: string }, i: number) => (
                    <Badge key={i} variant="info">
                      {mc.provider}/{mc.model}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validation Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Validation Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {test.expectedContains ? (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Expected Contains</h4>
                <p className="mt-1 rounded-md bg-gray-100 p-3 text-sm dark:bg-gray-800">
                  {test.expectedContains}
                </p>
              </div>
            ) : null}
            
            {test.jsonSchema ? (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">JSON Schema</h4>
                <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-gray-100 p-3 text-sm dark:bg-gray-800">
                  {JSON.stringify(JSON.parse(test.jsonSchema), null, 2)}
                </pre>
              </div>
            ) : null}
            
            {!test.expectedContains && !test.jsonSchema && (
              <p className="text-gray-500 dark:text-gray-400">
                No validation rules configured. Runs will not be marked as pass/fail.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Runs</CardTitle>
              <CardDescription>Latest executions of this test</CardDescription>
            </div>
            <Link href={`/runs?testId=${test.id}`}>
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <RecentRunsTable runs={test.runs} testId={test.id} />
        </CardContent>
      </Card>
    </div>
  );
}
