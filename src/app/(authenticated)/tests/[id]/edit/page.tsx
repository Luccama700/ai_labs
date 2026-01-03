import { notFound } from 'next/navigation';
import { getTest } from '@/app/actions/tests';
import { EditTestClient } from './edit-test-client';

interface EditTestPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTestPage({ params }: EditTestPageProps) {
  const { id } = await params;
  const test = await getTest(id);

  if (!test) {
    notFound();
  }

  return (
    <EditTestClient
      test={{
        id: test.id,
        name: test.name,
        description: test.description,
        basePrompt: test.basePrompt,
        variables: test.variables,
        modelConfigs: test.modelConfigs,
        expectedContains: test.expectedContains,
        jsonSchema: test.jsonSchema,
      }}
    />
  );
}
