import { createServiceRoleClient } from '@/lib/supabase/server';

const stageLabel: Record<string, string> = {
  soft: 'Soft Reminder Sent',
  firm: 'Firm Reminder Sent',
  final: 'Final Notice Sent',
};

const stageTone: Record<string, string> = {
  soft: 'bg-blue-50 text-blue-700 border-blue-200',
  firm: 'bg-amber-50 text-amber-700 border-amber-200',
  final: 'bg-red-50 text-red-700 border-red-200',
};

export async function RecoveryStatus({ invoiceId }: { invoiceId: string }) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('invoice_recovery_logs')
    .select('stage, sent_at')
    .eq('invoice_id', invoiceId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Recovery status: No reminders sent.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${stageTone[data.stage] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
      <p className="text-sm font-medium">{stageLabel[data.stage] ?? 'Recovery update logged'}</p>
      <p className="mt-1 text-xs opacity-80">{new Date(data.sent_at).toLocaleString('en-US')}</p>
    </div>
  );
}
