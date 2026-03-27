import { NextResponse } from 'next/server';
import { onInvoicePaidUpdateRisk } from '@/lib/billing/recovery';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isAuthorized(req: Request) {
  const webhookSecret = process.env.BILLING_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return false;
  }
  return req.headers.get('x-webhook-secret') === webhookSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { invoiceId } = (await request.json()) as { invoiceId: string };
    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoiceId.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('user_id, client_id, status')
      .eq('id', invoiceId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (invoice.status !== 'paid') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Invoice not paid.' });
    }

    const updated = await onInvoicePaidUpdateRisk({
      userId: invoice.user_id,
      clientId: invoice.client_id,
    });

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
