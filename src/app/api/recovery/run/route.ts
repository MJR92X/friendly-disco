import { NextResponse } from 'next/server';
import { runInvoiceRecovery } from '@/lib/billing/recovery';

function isAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const header = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  return header === cronSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runInvoiceRecovery();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recovery failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
