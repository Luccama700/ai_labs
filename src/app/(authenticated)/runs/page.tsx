import { getRuns } from '@/app/actions/runs';
import { RunsClient } from './runs-client';

export default async function RunsPage() {
  const { runs, total } = await getRuns({ limit: 100 });
  
  return <RunsClient initialRuns={runs} total={total} />;
}
