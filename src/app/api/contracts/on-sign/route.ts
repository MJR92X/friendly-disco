import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const ALLOWED_TIERS = new Set(['advanced', 'agency']);

type ContractPayload = {
  contractId: string;
  userId: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContractPayload;

    if (!body.contractId || !body.userId) {
      return NextResponse.json({ error: 'Missing contractId or userId.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', body.userId)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!ALLOWED_TIERS.has(profile.subscription_tier)) {
      return NextResponse.json({ error: 'Automation requires Advanced or Agency tier.' }, { status: 403 });
    }

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, user_id, client_id, title, milestone_amount, auto_invoice, signed_at')
      .eq('id', body.contractId)
      .eq('user_id', body.userId)
      .single();

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 500 });
    }

    if (!contract.signed_at) {
      return NextResponse.json({ error: 'Contract is not signed.' }, { status: 400 });
    }

    if (!contract.auto_invoice) {
      return NextResponse.json({ ok: true, created: false });
    }

    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('contract_id', contract.id)
      .eq('client_id', contract.client_id)
      .limit(1)
      .maybeSingle();

    if (existingInvoice) {
      return NextResponse.json({ ok: true, created: false, reason: 'Invoice already exists.' });
    }

    const signedAt = new Date(contract.signed_at);
    const dueDate = new Date(signedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: createdInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: contract.user_id,
        client_id: contract.client_id,
        contract_id: contract.id,
        invoice_number: `AUTO-${contract.id.slice(0, 8).toUpperCase()}`,
        amount_due: contract.milestone_amount ?? 0,
        due_date: dueDate,
        status: 'pending',
      })
      .select('id, invoice_number')
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, created: true, invoice: createdInvoice });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
