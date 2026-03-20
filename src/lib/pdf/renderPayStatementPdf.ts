"use client";

import React from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PayStatement from "@/components/PayStatement";
import { PayStatementData } from "@/types/payStatement";

export type PayStatementPreset = "current" | "bpv1";

/**
 * Renders a PayStatement React component offscreen and returns a base64 PDF (no data: prefix).
 * Matches the fallback canvas+jsPDF logic used in PDFGenerator to ensure identical output.
 */
export async function renderPayStatementPdfBase64(
  data: PayStatementData,
  options?: { preset?: PayStatementPreset }
): Promise<{ base64: string; mimeType: string }> {
  const preset = options?.preset ?? "bpv1";

  // Create an offscreen container
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "816px"; // 8.5in * 96dpi
  container.style.height = "1056px"; // 11in * 96dpi
  container.style.pointerEvents = "none";
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  // Render the PayStatement inside the container
  const root = createRoot(container);
  await new Promise<void>((resolve) => {
    root.render(
      React.createElement(
        "div",
        null,
        React.createElement(PayStatement, { data, preset })
      )
    );
    // Allow a frame for layout/paint
    requestAnimationFrame(() => resolve());
  });

  // Ensure web fonts are loaded and allow a short delay for images/layout
  try {
    const fontDoc = document as unknown as { fonts?: { ready?: Promise<void> } };
    if (fontDoc.fonts && fontDoc.fonts.ready) {
      await fontDoc.fonts.ready;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 50));

  try {
    // Capture to canvas at Letter size (96dpi), mirroring PDFGenerator
    const targetW = Math.round(8.5 * 96);
    const targetH = Math.round(11 * 96);
    const canvas = await html2canvas(container, {
      width: targetW,
      height: targetH,
      windowWidth: targetW,
      windowHeight: targetH,
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "letter" });

    // Map CSS px to PDF points (72 dpi): 1in CSS (96px) = 72pt
    const pxToPt = (px: number) => (px * 72) / 96;
    const width = pxToPt(targetW);
    const height = pxToPt(targetH);
    pdf.addImage(imgData, "PNG", 0, 0, width, height);

    // Return as base64 without data: prefix
    const dataUri = pdf.output("datauristring");
    const base64 = dataUri.split(",")[1] || "";
    return { base64, mimeType: "application/pdf" };
  } finally {
    // Cleanup
    try {
      root.unmount();
    } catch {}
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

