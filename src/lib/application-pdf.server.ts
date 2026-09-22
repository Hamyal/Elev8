/**
 * Server-only renderer that turns a submitted application's Review-page model
 * into a printable PDF. The model is built from the exact same field
 * definitions the applicant sees on Step 5, so this file only lays the content
 * out — it never derives, relabels, or reorders answers.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export type ApplicationPdfRow = {
  label: string;
  value: string;
  lines?: string[];
  blocks?: { title: string; fields: { label: string; value: string }[] }[];
};
export type ApplicationPdfSection = { label: string; rows: ApplicationPdfRow[] };

export type ApplicationPdfModel = {
  reference: string;
  submittedAt: string;
  applicantName: string;
  sections: ApplicationPdfSection[];
  acknowledgment?: { statement: string; typedName: string } | undefined;
  /** Absolute URL of the Elev8 logo; falls back to a wordmark when unreachable. */
  logoUrl?: string | undefined;
};

const NAVY = rgb(0x0f / 255, 0x24 / 255, 0x40 / 255);
const ORANGE = rgb(0xf4 / 255, 0x58 / 255, 0x1b / 255);
const TEAL = rgb(0x17 / 255, 0x84 / 255, 0x9a / 255);
const MUTED = rgb(0.36, 0.4, 0.45);
const LINE = rgb(0.85, 0.87, 0.89);
const TINT = rgb(0.96, 0.97, 0.98);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Standard PDF fonts are WinAnsi; normalize typographic characters. */
function ascii(input: string): string {
  return (input ?? "")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022\u25CF]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of ascii(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      let candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // A single token longer than the column is split so nothing is clipped.
      candidate = word;
      while (font.widthOfTextAtSize(candidate, size) > maxWidth && candidate.length > 1) {
        let cut = candidate.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(candidate.slice(0, cut), size) > maxWidth) cut--;
        lines.push(candidate.slice(0, cut));
        candidate = candidate.slice(cut);
      }
      line = candidate;
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

async function loadLogo(doc: PDFDocument, url?: string): Promise<PDFImage | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    return await doc.embedPng(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return undefined;
  }
}

export async function renderApplicationPdf(model: ApplicationPdfModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Elev8 Support Professional Application ${model.reference}`);
  doc.setCreator("Elev8 Services California");

  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(doc, model.logoUrl);

  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    y = PAGE_H - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 30) newPage();
  };

  // ---- Header -------------------------------------------------------------
  if (logo) {
    const h = 44;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: MARGIN, y: y - h, width: Math.min(w, 200), height: h });
  } else {
    page.drawText("elev8", { x: MARGIN, y: y - 26, size: 26, font: bold, color: ORANGE });
    page.drawText("SERVICES CALIFORNIA", {
      x: MARGIN,
      y: y - 40,
      size: 8,
      font: bold,
      color: NAVY,
    });
  }

  const submitted = new Date(model.submittedAt);
  const stamp = ascii(
    submitted.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      dateStyle: "long",
      timeStyle: "short",
    }) + " (Pacific)",
  );
  const headerRight = [
    { text: "Submitted Application", font: bold, size: 11, color: NAVY },
    { text: `Reference ${model.reference}`, font: body, size: 9, color: MUTED },
    { text: stamp, font: body, size: 9, color: MUTED },
  ];
  let hy = y - 12;
  for (const line of headerRight) {
    const w = line.font.widthOfTextAtSize(line.text, line.size);
    page.drawText(line.text, {
      x: PAGE_W - MARGIN - w,
      y: hy,
      size: line.size,
      font: line.font,
      color: line.color,
    });
    hy -= line.size + 3;
  }

  y -= 56;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: LINE,
  });
  y -= 26;

  page.drawText(ascii(model.applicantName || "Applicant"), {
    x: MARGIN,
    y,
    size: 18,
    font: bold,
    color: NAVY,
  });
  y -= 14;
  page.drawText("Support Professional application - review summary", {
    x: MARGIN,
    y: y - 4,
    size: 9.5,
    font: body,
    color: TEAL,
  });
  y -= 26;

  // ---- Sections -----------------------------------------------------------
  for (const section of model.sections) {
    if (!section.rows.length) continue;
    ensure(56);
    page.drawRectangle({
      x: MARGIN,
      y: y - 20,
      width: CONTENT_W,
      height: 22,
      color: TINT,
      borderColor: LINE,
      borderWidth: 0.6,
    });
    page.drawRectangle({ x: MARGIN, y: y - 20, width: 3, height: 22, color: TEAL });
    page.drawText(ascii(section.label).toUpperCase(), {
      x: MARGIN + 12,
      y: y - 13,
      size: 9.5,
      font: bold,
      color: NAVY,
    });
    y -= 32;

    /** Question label above, complete answer directly underneath. */
    const draw = (
      text: string,
      opts: { x: number; size: number; font: PDFFont; color: typeof NAVY; width: number },
    ) => {
      for (const line of wrap(text, opts.font, opts.size, opts.width)) {
        ensure(opts.size + 6);
        page.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color });
        y -= opts.size + 3;
      }
    };

    for (const row of section.rows) {
      ensure(30);
      draw(row.label, { x: MARGIN, size: 9, font: body, color: MUTED, width: CONTENT_W });
      if (row.blocks?.length) {
        for (const block of row.blocks) {
          y -= 4;
          draw(block.title, {
            x: MARGIN + 12,
            size: 9,
            font: bold,
            color: TEAL,
            width: CONTENT_W - 12,
          });
          for (const field of block.fields) {
            draw(field.label, {
              x: MARGIN + 12,
              size: 8.5,
              font: body,
              color: MUTED,
              width: CONTENT_W - 12,
            });
            draw(field.value || "-", {
              x: MARGIN + 12,
              size: 9,
              font: bold,
              color: NAVY,
              width: CONTENT_W - 12,
            });
          }
        }
      } else if (row.lines?.length) {
        for (const line of row.lines) {
          draw(line, { x: MARGIN + 12, size: 9, font: bold, color: NAVY, width: CONTENT_W - 12 });
        }
      } else {
        draw(row.value || "-", {
          x: MARGIN + 12,
          size: 9,
          font: bold,
          color: NAVY,
          width: CONTENT_W - 12,
        });
      }
      y -= 6;
      page.drawLine({
        start: { x: MARGIN, y: y + 4 },
        end: { x: PAGE_W - MARGIN, y: y + 4 },
        thickness: 0.4,
        color: LINE,
      });
      y -= 4;
    }
    y -= 12;
  }

  // ---- Acknowledgment -----------------------------------------------------
  if (model.acknowledgment) {
    const statement = wrap(model.acknowledgment.statement, body, 9, CONTENT_W - 24);
    const boxHeight = statement.length * 12 + 58;
    ensure(boxHeight + 10);
    page.drawRectangle({
      x: MARGIN,
      y: y - boxHeight,
      width: CONTENT_W,
      height: boxHeight,
      color: TINT,
      borderColor: LINE,
      borderWidth: 0.6,
    });
    let ay = y - 18;
    page.drawText("APPLICANT ACKNOWLEDGMENT", {
      x: MARGIN + 12,
      y: ay,
      size: 9.5,
      font: bold,
      color: NAVY,
    });
    ay -= 16;
    for (const line of statement) {
      page.drawText(line, { x: MARGIN + 12, y: ay, size: 9, font: body, color: MUTED });
      ay -= 12;
    }
    ay -= 6;
    page.drawText(`Signed: ${ascii(model.acknowledgment.typedName)}`, {
      x: MARGIN + 12,
      y: ay,
      size: 10,
      font: bold,
      color: NAVY,
    });
    y -= boxHeight + 12;
  }

  // ---- Footers ------------------------------------------------------------
  pages.forEach((p, index) => {
    const footer = ascii(
      `Elev8 Services California - confidential applicant record - ${model.reference}`,
    );
    p.drawText(footer, { x: MARGIN, y: MARGIN - 18, size: 7.5, font: body, color: MUTED });
    const label = `Page ${index + 1} of ${pages.length}`;
    p.drawText(label, {
      x: PAGE_W - MARGIN - body.widthOfTextAtSize(label, 7.5),
      y: MARGIN - 18,
      size: 7.5,
      font: body,
      color: MUTED,
    });
  });

  return await doc.save();
}

export const APPLICATION_PDF_BUCKET = "application-pdfs";

export function applicationPdfPath(reference: string, applicantName: string): string {
  const safeName = applicantName.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "Applicant";
  return `applications/${reference}/${reference} - ${safeName} - Submitted Application.pdf`;
}
