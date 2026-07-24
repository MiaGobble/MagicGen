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

const CARD_W_MM = 63;
const CARD_H_MM = 88;

const PAPER: Record<ProxyPdfOptions["paper"], { w: number; h: number }> = {
  letter: { w: 215.9, h: 279.4 },
  a4: { w: 210, h: 297 },
};

/** Fetch card art and rasterize to JPEG data URL so jsPDF can embed it reliably. */
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

export async function generateProxyPdf(
  cards: ScryfallCard[],
  options: ProxyPdfOptions,
): Promise<void> {
  const paper = PAPER[options.paper];
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paper.w, paper.h],
  });

  const bleed = Math.max(0, options.bleedMm);
  const gap = Math.max(0, options.gapMm);
  const cellW = CARD_W_MM + bleed * 2;
  const cellH = CARD_H_MM + bleed * 2;
  const cols = options.columns;
  const rows = options.rows;
  const perPage = cols * rows;

  const gridW = cols * cellW + (cols - 1) * gap;
  const gridH = rows * cellH + (rows - 1) * gap;
  const originX = (paper.w - gridW) / 2;
  const originY = (paper.h - gridH) / 2;

  for (let i = 0; i < cards.length; i++) {
    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage([paper.w, paper.h]);

    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = originX + col * (cellW + gap);
    const y = originY + row * (cellH + gap);

    const card = cards[i];
    // Prefer PNG for crispness; fall back through sizes
    const src =
      getCardImage(card, "png") ||
      getCardImage(card, "large") ||
      getCardImage(card, "normal");

    try {
      const dataUrl = await imageToJpegDataUrl(src);
      doc.addImage(dataUrl, "JPEG", x, y, cellW, cellH);
    } catch {
      doc.setFillColor(30, 30, 30);
      doc.rect(x, y, cellW, cellH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(card.name, x + 2, y + cellH / 2, { maxWidth: cellW - 4 });
    }

    const stampH = 5;
    doc.setFillColor(0, 0, 0);
    doc.rect(x, y + cellH - stampH, cellW, stampH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.5);
    doc.text(options.stamp, x + cellW / 2, y + cellH - stampH / 2 + 0.8, {
      align: "center",
      baseline: "middle",
    });

    if (options.cutGuides) {
      const cutX = x + bleed;
      const cutY = y + bleed;
      const cutW = CARD_W_MM;
      const cutH = CARD_H_MM;
      const mark = 2.5;
      doc.setDrawColor(180, 40, 40);
      doc.setLineWidth(0.15);
      doc.line(cutX - mark, cutY, cutX, cutY);
      doc.line(cutX, cutY - mark, cutX, cutY);
      doc.line(cutX + cutW, cutY, cutX + cutW + mark, cutY);
      doc.line(cutX + cutW, cutY - mark, cutX + cutW, cutY);
      doc.line(cutX - mark, cutY + cutH, cutX, cutY + cutH);
      doc.line(cutX, cutY + cutH, cutX, cutY + cutH + mark);
      doc.line(cutX + cutW, cutY + cutH, cutX + cutW + mark, cutY + cutH);
      doc.line(cutX + cutW, cutY + cutH, cutX + cutW, cutY + cutH + mark);
    }
  }

  doc.save("magicgen-proxies.pdf");
}
