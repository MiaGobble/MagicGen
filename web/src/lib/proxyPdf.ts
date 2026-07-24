import { jsPDF } from "jspdf";
import { getCardImage, type ScryfallCard } from "./scryfall";

export type ProxyPdfOptions = {
  bleedMm: number;
  cutGuides: boolean;
  gapMm: number;
  paper: "letter" | "a4";
  columns: number;
  rows: number;
  stamp: string;
};

export type ProxyPdfFailure = { name: string; reason: string };

export type ProxyPdfResult =
  | { ok: true }
  | { ok: false; failures: ProxyPdfFailure[] };

/** Finished card size after trimming (poker size). */
const TRIM_W_MM = 63;
const TRIM_H_MM = 88;

const PAPER: Record<ProxyPdfOptions["paper"], { w: number; h: number }> = {
  letter: { w: 215.9, h: 279.4 },
  a4: { w: 210, h: 297 },
};

async function imageToJpegDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function loadCardImage(card: ScryfallCard): Promise<string> {
  const candidates = [
    getCardImage(card, "png"),
    getCardImage(card, "large"),
    getCardImage(card, "normal"),
  ].filter((u, i, arr) => u && arr.indexOf(u) === i);

  let lastError = "No image URL";
  for (const src of candidates) {
    try {
      return await imageToJpegDataUrl(src);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}

/**
 * Draw crop marks at the trim rectangle. Marks extend outward into bleed / margin
 * and a short distance inward onto the card face.
 */
function drawCutGuides(
  doc: jsPDF,
  cutX: number,
  cutY: number,
  cutW: number,
  cutH: number,
  bleed: number,
) {
  const outward = Math.max(12, bleed + 6);
  const inward = Math.max(2, Math.min(bleed || 3, 4));
  doc.setDrawColor(180, 40, 40);
  doc.setLineWidth(0.25);
  // Top-left
  doc.line(cutX - outward, cutY, cutX + inward, cutY);
  doc.line(cutX, cutY - outward, cutX, cutY + inward);
  // Top-right
  doc.line(cutX + cutW - inward, cutY, cutX + cutW + outward, cutY);
  doc.line(cutX + cutW, cutY - outward, cutX + cutW, cutY + inward);
  // Bottom-left
  doc.line(cutX - outward, cutY + cutH, cutX + inward, cutY + cutH);
  doc.line(cutX, cutY + cutH - inward, cutX, cutY + cutH + outward);
  // Bottom-right
  doc.line(cutX + cutW - inward, cutY + cutH, cutX + cutW + outward, cutY + cutH);
  doc.line(cutX + cutW, cutY + cutH - inward, cutX + cutW, cutY + cutH + outward);
}

export async function generateProxyPdf(
  cards: ScryfallCard[],
  options: ProxyPdfOptions,
): Promise<ProxyPdfResult> {
  // Preload every image — abort with a full failure list rather than a partial PDF
  const loaded: string[] = [];
  const failures: ProxyPdfFailure[] = [];

  for (const card of cards) {
    try {
      loaded.push(await loadCardImage(card));
    } catch (err) {
      failures.push({
        name: card.name,
        reason: err instanceof Error ? err.message : "Could not load card image from Scryfall",
      });
    }
  }

  if (failures.length) {
    return { ok: false, failures };
  }

  const paper = PAPER[options.paper];
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paper.w, paper.h],
  });

  const bleed = Math.max(0, options.bleedMm);
  const gap = Math.max(0, options.gapMm);
  // Print cell = trim + bleed on every side. Image fills this entire cell so art
  // extends past the cut edge (real print bleed). Cut guides sit on the trim box.
  const imgW = TRIM_W_MM + bleed * 2;
  const imgH = TRIM_H_MM + bleed * 2;
  const cols = options.columns;
  const rows = options.rows;
  const perPage = cols * rows;

  const gridW = cols * imgW + (cols - 1) * gap;
  const gridH = rows * imgH + (rows - 1) * gap;
  const originX = (paper.w - gridW) / 2;
  const originY = (paper.h - gridH) / 2;

  for (let i = 0; i < cards.length; i++) {
    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage([paper.w, paper.h]);

    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = originX + col * (imgW + gap);
    const y = originY + row * (imgH + gap);

    // Oversized image: larger than trim whenever bleedMm > 0
    doc.addImage(loaded[i], "JPEG", x, y, imgW, imgH);

    const trimX = x + bleed;
    const trimY = y + bleed;
    const stampH = 5;
    // Stamp sits on the finished card face (trim), not out in the bleed margin
    doc.setFillColor(0, 0, 0);
    doc.rect(trimX, trimY + TRIM_H_MM - stampH, TRIM_W_MM, stampH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.5);
    doc.text(options.stamp, trimX + TRIM_W_MM / 2, trimY + TRIM_H_MM - stampH / 2 + 0.8, {
      align: "center",
      baseline: "middle",
    });

    if (options.cutGuides) {
      drawCutGuides(doc, trimX, trimY, TRIM_W_MM, TRIM_H_MM, bleed);
    }
  }

  doc.save("magicgen-proxies.pdf");
  return { ok: true };
}
