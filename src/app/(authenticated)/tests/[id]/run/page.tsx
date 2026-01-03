import { notFound } from 'next/navigation';
import { getTest } from '@/app/actions/tests';
import { getActiveKeysByProvider } from '@/app/actions/keys';
import { RunTestClient } from './run-test-client';

interface RunTestPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunTestPage({ params }: RunTestPageProps) {
  const { id } = await params;
  const [test, keysByProvider] = await Promise.all([
    getTest(id),
    getActiveKeysByProvider(),
  ]);

  if (!test) {
    notFound();
  }

  return (
    <RunTestClient
      test={{
        id: test.id,
        name: test.name,
        basePrompt: test.basePrompt,
        variables: test.variables,
      }}
      keysByProvider={keysByProvider}
    />
  );
}
