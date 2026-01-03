import { NextRequest, NextResponse } from 'next/server';
import { exportRuns } from '@/app/actions/runs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = (searchParams.get('format') || 'json') as 'json' | 'csv';
  const testId = searchParams.get('testId') || undefined;

  try {
    const data = await exportRuns(format, testId);
    
    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const extension = format === 'json' ? 'json' : 'csv';
    const filename = `ai-lab-runs-${Date.now()}.${extension}`;

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
