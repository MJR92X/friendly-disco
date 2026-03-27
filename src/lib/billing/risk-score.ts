import type { SupabaseClient } from '@supabase/supabase-js';

type InvoiceRecord = {
  user_id: string;
  client_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
};

function computeScore(lateCount: number, avgDelayDays: number) {
  const raw = 100 - lateCount * 10 - avgDelayDays * 0.5;
  return Math.max(0, Number(raw.toFixed(2)));
}

function computeDelayDays(dueDate: string, paidAt: string | null) {
  const due = new Date(dueDate);
  const paid = paidAt ? new Date(paidAt) : new Date();
  const ms = paid.getTime() - due.getTime();
  return ms > 0 ? ms / (1000 * 60 * 60 * 24) : 0;
}

export async function updateClientRiskScore(
  supabase: SupabaseClient,
  params: { userId: string; clientId: string },
) {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('user_id, client_id, due_date, paid_at, status')
    .eq('user_id', params.userId)
    .eq('client_id', params.clientId)
    .in('status', ['paid', 'overdue']);

  if (error) {
    throw error;
  }

  const list = (invoices ?? []) as InvoiceRecord[];
  let lateCount = 0;
  let totalDelay = 0;

  for (const invoice of list) {
    const delay = computeDelayDays(invoice.due_date, invoice.paid_at);
    if (delay > 0) {
      lateCount += 1;
      totalDelay += delay;
    }
  }

  const avgDelayDays = lateCount > 0 ? Number((totalDelay / lateCount).toFixed(2)) : 0;
  const score = computeScore(lateCount, avgDelayDays);

  const { error: upsertError } = await supabase.from('client_scores').upsert(
    {
      user_id: params.userId,
      client_id: params.clientId,
      late_count: lateCount,
      avg_delay_days: avgDelayDays,
      score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'client_id' },
  );

  if (upsertError) {
    throw upsertError;
  }

  return { lateCount, avgDelayDays, score };
}
