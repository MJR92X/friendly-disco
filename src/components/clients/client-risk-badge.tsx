import { createServiceRoleClient } from '@/lib/supabase/server';

const toneByLabel: Record<string, string> = {
  Safe: 'bg-emerald-100 text-emerald-700',
  Moderate: 'bg-amber-100 text-amber-700',
  Risky: 'bg-red-100 text-red-700',
};

export async function ClientRiskBadge({ clientId }: { clientId: string }) {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('client_scores')
    .select('score, label')
    .eq('client_id', clientId)
    .maybeSingle();

  const label = data?.label ?? 'Safe';
  const score = Number(data?.score ?? 100).toFixed(1);

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${toneByLabel[label] ?? toneByLabel.Safe}`}>
      <span>{label}</span>
      <span>{score}</span>
    </span>
  );
}
