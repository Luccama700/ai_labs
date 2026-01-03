import { getTests } from '@/app/actions/tests';
import { CompareClient } from './compare-client';

export default async function ComparePage() {
  const tests = await getTests();
  
  return (
    <CompareClient
      tests={tests.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
