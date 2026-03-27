export type RecoveryStage = 'soft' | 'firm' | 'final';

export function buildRecoveryEmailTemplate(params: {
  clientName: string;
  invoiceNumber: string;
  amountDue: number;
  dueDate: string;
  stage: RecoveryStage;
}) {
  const stageCopy: Record<RecoveryStage, { subjectPrefix: string; intro: string }> = {
    soft: {
      subjectPrefix: 'Friendly reminder',
      intro: 'Just a quick reminder that this invoice is now overdue.',
    },
    firm: {
      subjectPrefix: 'Action needed',
      intro: 'Your invoice remains unpaid and now requires attention.',
    },
    final: {
      subjectPrefix: 'Final notice',
      intro: 'This is the final reminder before account escalation.',
    },
  };

  const copy = stageCopy[params.stage];
  const subject = `${copy.subjectPrefix}: Invoice ${params.invoiceNumber}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:620px;padding:24px;border:1px solid #e5e7eb;border-radius:12px;color:#111827">
      <h2 style="margin:0 0 12px">Invoice ${params.invoiceNumber}</h2>
      <p style="margin:0 0 12px">Hi ${params.clientName},</p>
      <p style="margin:0 0 16px">${copy.intro}</p>
      <div style="background:#f9fafb;padding:16px;border-radius:10px;margin:0 0 16px">
        <p style="margin:0 0 8px"><strong>Amount due:</strong> $${params.amountDue.toFixed(2)}</p>
        <p style="margin:0"><strong>Due date:</strong> ${params.dueDate}</p>
      </div>
      <p style="margin:0">Please submit payment as soon as possible to avoid service interruptions.</p>
    </div>
  `.trim();

  const text = [
    `Hi ${params.clientName},`,
    copy.intro,
    `Invoice: ${params.invoiceNumber}`,
    `Amount due: $${params.amountDue.toFixed(2)}`,
    `Due date: ${params.dueDate}`,
    'Please submit payment as soon as possible.',
  ].join('\n');

  return { subject, html, text };
}
