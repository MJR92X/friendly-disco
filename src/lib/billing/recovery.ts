import { buildRecoveryEmailTemplate, type RecoveryStage } from '@/lib/email/recovery-template';
import { updateClientRiskScore } from '@/lib/billing/risk-score';
import { createServiceRoleClient } from '@/lib/supabase/server';

type RecoveryInvoice = {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  amount_due: number;
  due_date: string;
  status: string;
  clients: {
    id: string;
    name: string;
    email: string;
  } | null;
};

function stageForDaysOverdue(days: number): RecoveryStage | null {
  if (days >= 14) return 'final';
  if (days >= 7) return 'firm';
  if (days >= 3) return 'soft';
  return null;
}

async function sendRecoveryEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const endpoint = process.env.RECOVERY_EMAIL_ENDPOINT;
  const apiKey = process.env.RECOVERY_EMAIL_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error('Missing recovery email provider configuration.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Recovery email request failed with status ${response.status}.`);
  }
}

export async function runInvoiceRecovery() {
  const supabase = createServiceRoleClient();
  const today = new Date();

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, user_id, client_id, invoice_number, amount_due, due_date, status, clients(id, name, email)')
    .eq('status', 'overdue')
    .lte('due_date', new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    throw error;
  }

  const processed: Array<{ invoiceId: string; stage: RecoveryStage }> = [];

  for (const invoice of (invoices ?? []) as RecoveryInvoice[]) {
    const dueDate = new Date(invoice.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const stage = stageForDaysOverdue(daysOverdue);

    if (!stage || !invoice.clients?.email) {
      continue;
    }

    const { data: existingLog, error: existingLogError } = await supabase
      .from('invoice_recovery_logs')
      .select('id')
      .eq('invoice_id', invoice.id)
      .eq('stage', stage)
      .maybeSingle();

    if (existingLogError) {
      throw existingLogError;
    }

    if (existingLog) {
      continue;
    }

    const template = buildRecoveryEmailTemplate({
      clientName: invoice.clients.name,
      invoiceNumber: invoice.invoice_number,
      amountDue: Number(invoice.amount_due),
      dueDate: dueDate.toLocaleDateString('en-US'),
      stage,
    });

    await sendRecoveryEmail({
      to: invoice.clients.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    const { error: insertError } = await supabase.from('invoice_recovery_logs').insert({
      user_id: invoice.user_id,
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      stage,
      sent_to: invoice.clients.email,
      sent_at: new Date().toISOString(),
    });

    if (insertError) {
      throw insertError;
    }

    await updateClientRiskScore(supabase, {
      userId: invoice.user_id,
      clientId: invoice.client_id,
    });

    processed.push({ invoiceId: invoice.id, stage });
  }

  return {
    processed,
    total: processed.length,
  };
}

export async function onInvoicePaidUpdateRisk(params: { userId: string; clientId: string }) {
  const supabase = createServiceRoleClient();
  return updateClientRiskScore(supabase, params);
}
