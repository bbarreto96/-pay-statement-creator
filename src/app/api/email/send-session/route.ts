import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import puppeteer, { Browser } from "puppeteer";
import PayStatement from "@/components/PayStatement";
import { PayStatementData } from "@/types/payStatement";

// Simple provider: Resend REST API via fetch (no SDK needed)
// Also supports macOS Mail draft via AppleScript when mode="macos"

type RenderItem = {
  filename: string;
  preset?: "current" | "bpv1";
  data: PayStatementData;
};

// Concurrency limiter (no external deps)
function createLimiter(limit: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active--;
    if (queue.length) queue.shift()!();
  };
  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

async function withBrowser<T>(fn: (browser: Browser) => Promise<T>) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function renderPdfBufferPuppeteer(browser: Browser, contentHtml: string) {
  const page = await browser.newPage();
  await page.emulateMediaType("print");
  await page.setContent(contentHtml, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 100));
  const pdf = await page.pdf({
    format: "Letter",
    printBackground: true,
    margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
    preferCSSPageSize: true,
  });
  await page.close();
  return pdf;
}

async function buildHtmlForItem(item: RenderItem, sharedAssets?: { logoB64?: string; fontCss?: string }) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const raw = renderToStaticMarkup(React.createElement(PayStatement, { data: item.data, preset: item.preset || "bpv1" }));
  let content = raw;
  if (sharedAssets?.logoB64) {
    content = content.replace(/src="\/Logo-01\.png"/g, `src="data:image/png;base64,${sharedAssets.logoB64}"`);
  }
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Pay Statement</title>
  ${sharedAssets?.fontCss || '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">'}
  <style>
    @page { size: Letter; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  return html;
}

async function renderBatchToBuffers(items: RenderItem[], concurrency = 4) {
  return await withBrowser(async (browser) => {
    let logoB64: string | undefined;
    try {
      const logoPath = path.join(process.cwd(), "public", "Logo-01.png");
      const logoBuf = fs.readFileSync(logoPath);
      logoB64 = logoBuf.toString("base64");
    } catch {}

    let fontCss: string | undefined;
    try {
      const cssPath = path.join(process.cwd(), "public", "fonts", "poppins.css");
      if (fs.existsSync(cssPath)) {
        fontCss = `<style>${fs.readFileSync(cssPath, "utf-8")}</style>`;
      }
    } catch {}

    const limiter = createLimiter(Math.max(1, Math.min(8, concurrency)));
    const results: Array<{ filename: string; buffer: Buffer } | undefined> = new Array(items.length);
    await Promise.all(
      items.map((it, index) =>
        limiter(async () => {
          const html = await buildHtmlForItem(it, { logoB64, fontCss });
          const buf = await renderPdfBufferPuppeteer(browser, html);
          const nodeBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
          results[index] = { filename: it.filename, buffer: nodeBuf };
        })
      )
    );
    return results.filter(Boolean) as { filename: string; buffer: Buffer }[];
  });
}



type Attachment = {
  filename: string;
  contentBase64: string; // base64-encoded file bytes
  mimeType: string;
};

function escAppleScriptString(s: string) {
  // Escape backslashes and quotes for AppleScript string literal
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function createMailDraft(to: string[], subject: string, body: string, filePaths: string[]) {
  // Build the AppleScript
  const toLines = to.map((addr) => `make new to recipient at end of to recipients with properties {address:"${escAppleScriptString(addr)}"}`);
  const attachLines = filePaths.map((p) => {
    const posix = escAppleScriptString(p);
    return `tell content to make new attachment with properties {file name:(POSIX file "${posix}")}`;
  });

  const script = [
    'tell application "Mail"',
    `set newMessage to make new outgoing message with properties {subject:"${escAppleScriptString(subject)}", content:"${escAppleScriptString(body)}\n", visible:true}`,
    'tell newMessage',
    ...toLines,
    ...attachLines,
    'end tell',
    'activate',
    'end tell',
  ].join("\n");

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("osascript", ["-e", script]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += String(d)));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `osascript exited with code ${code}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, attachments, meta, mode, renderItems } = (await req.json()) as {
      to: string[];
      subject: string;
      body: string;
      attachments?: Attachment[];
      renderItems?: RenderItem[];
      meta?: { payPeriodLabel?: string; count?: number; totalAmount?: number; filenames?: string[] };
      mode?: "macos" | "resend";
    };

    if (!Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: "Missing recipients" }, { status: 400 });
    }
    if (!subject || typeof subject !== "string") {
      return NextResponse.json({ error: "Missing subject" }, { status: 400 });
    }
    if ((!Array.isArray(attachments) || attachments.length === 0) && (!Array.isArray(renderItems) || renderItems.length === 0)) {
      return NextResponse.json({ error: "No attachments or renderItems provided" }, { status: 400 });
    }

    if (mode === "macos") {
      // Create temp files using server-rendered PDFs when renderItems provided; fallback to provided attachments
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "psc-mail-"));
      const filePaths: string[] = [];

      if (Array.isArray(renderItems) && renderItems.length > 0) {
        const rendered = await renderBatchToBuffers(renderItems, 5);
        for (const r of rendered) {
          const safe = r.filename.replace(/[^A-Za-z0-9_.-]+/g, "_") || "attachment.pdf";
          const fp = path.join(tempDir, safe);
          fs.writeFileSync(fp, r.buffer);
          try { console.log("[api/email/send-session] rendered file", safe, { bytes: r.buffer.length }); } catch {}
          filePaths.push(fp);
        }
      } else if (Array.isArray(attachments) && attachments.length > 0) {
        for (const a of attachments) {
          const safe = a.filename.replace(/[^A-Za-z0-9_.-]+/g, "_") || "attachment.pdf";
          const fp = path.join(tempDir, safe);
          const buf = Buffer.from(a.contentBase64, "base64");
          fs.writeFileSync(fp, buf);
          try { console.log("[api/email/send-session] wrote file", safe, { bytes: buf.length }); } catch {}
          filePaths.push(fp);
        }
      }

      await createMailDraft(to, subject, body, filePaths);

      // Optional logging
      try {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          await supabase.from("email_logs").insert({
            pay_period_label: meta?.payPeriodLabel ?? null,
            to_emails: to,
            subject,
            body_preview: (body || "").slice(0, 500),
            attachments_count: (renderItems?.length ?? attachments?.length ?? 0),
            total_amount: typeof meta?.totalAmount === "number" ? meta.totalAmount : null,
            filenames: meta?.filenames || (renderItems?.map((r) => r.filename) ?? attachments?.map((a) => a.filename) ?? []),
            provider_id: null,
          });
        }
      } catch {}

      return NextResponse.json({ ok: true, providerId: null, mode: "macos" });
    }

    // Default: Resend (optional)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM = process.env.RESEND_FROM;
    if (!RESEND_API_KEY || !RESEND_FROM) {
      return NextResponse.json(
        { error: "Email service not configured. Set RESEND_API_KEY and RESEND_FROM in env or use mode=macos." },
        { status: 500 }
      );
    }

    // Build attachments: prefer server-rendered items for print-engine consistency
    let outAttachments: { filename: string; content: string }[] = [];
    if (Array.isArray(renderItems) && renderItems.length > 0) {
      const rendered = await renderBatchToBuffers(renderItems, 5);
      outAttachments = rendered.map((r) => ({ filename: r.filename, content: r.buffer.toString("base64") }));
    } else if (Array.isArray(attachments) && attachments.length > 0) {
      outAttachments = attachments.map((a) => ({ filename: a.filename, content: a.contentBase64 }));
    }

    // Build Resend payload
    const payload = {
      from: RESEND_FROM,
      to,
      subject,
      html: `<div style=\"font-family:system-ui,Segoe UI,Arial\">${
        body?.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>") || ""
      }</div>`,
      attachments: outAttachments,
    } as const;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `Email provider error (${resp.status}): ${text}` }, { status: 502 });
    }

    const data = await resp.json();

    // Best-effort logging
    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await supabase.from("email_logs").insert({
          pay_period_label: meta?.payPeriodLabel ?? null,
          to_emails: to,
          subject,
          body_preview: (body || "").slice(0, 500),
          attachments_count: (renderItems?.length ?? attachments?.length ?? 0),
          total_amount: typeof meta?.totalAmount === "number" ? meta.totalAmount : null,
          filenames: meta?.filenames || (renderItems?.map((r) => r.filename) ?? attachments?.map((a) => a.filename) ?? []),
          provider_id: data?.id ?? null,
        });
      }
    } catch {}

    return NextResponse.json({ ok: true, providerId: data?.id ?? null, mode: "resend" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
