export type EmailTemplateKey = "summary" | "short";

export const emailTemplates: { key: EmailTemplateKey; name: string; subject: string; body: string }[] = [
  {
    key: "summary",
    name: "Summary (default)",
    subject: "Pay Statements – {{payPeriod}}",
    body: [
      "Hello,",
      "",
      "Please find attached the pay statements for {{count}} contractor(s) for pay period {{payPeriod}}.",
      "Total amount: {{totalAmount}}.",
      "",
      "Regards,",
      "Payroll",
    ].join("\n"),
  },
  {
    key: "short",
    name: "Short note",
    subject: "Pay statements for {{payPeriod}}",
    body: "Attached: {{count}} statements (total {{totalAmount}}).",
  },
];

export function renderTemplate(t: { subject: string; body: string }, ctx: { payPeriod: string; count: number; totalAmount: string }) {
  const replace = (s: string) =>
    s
      .replace(/{{\s*payPeriod\s*}}/g, ctx.payPeriod)
      .replace(/{{\s*count\s*}}/g, String(ctx.count))
      .replace(/{{\s*totalAmount\s*}}/g, ctx.totalAmount);
  return { subject: replace(t.subject), body: replace(t.body) };
}

