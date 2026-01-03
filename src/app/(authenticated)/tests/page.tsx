import Link from 'next/link';
import { getTests } from '@/app/actions/tests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime, truncate } from '@/lib/utils';

export default async function TestsPage() {
  const tests = await getTests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tests</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Create and manage your test definitions
          </p>
        </div>
        <Link href="/tests/new">
          <Button>Create Test</Button>
        </Link>
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No tests yet.{' '}
              <Link href="/tests/new" className="text-blue-600 hover:underline dark:text-blue-400">
                Create your first test
              </Link>{' '}
              to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <Card key={test.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{test.name}</CardTitle>
                    {test.description && (
                      <CardDescription>{truncate(test.description, 100)}</CardDescription>
                    )}
                  </div>
                  <Badge variant="info">{test._count.runs} runs</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <div>
                    <span className="font-medium">Prompt:</span>{' '}
                    {truncate(test.basePrompt, 80)}
                  </div>
                  <div className="flex gap-2">
                    {test.expectedContains && <Badge variant="default">Contains check</Badge>}
                    {test.jsonSchema && <Badge variant="default">Schema check</Badge>}
                  </div>
                  <div className="text-xs">
                    Updated {formatRelativeTime(test.updatedAt)}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/tests/${test.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      View
                    </Button>
                  </Link>
                  <Link href={`/tests/${test.id}/run`} className="flex-1">
                    <Button className="w-full" size="sm">
                      Run
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
