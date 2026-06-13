/* Generate the three demo PDFs for the upload-flow walkthrough:
 *
 *   1. clean-hearing.pdf  — pristine hearing notice (dataset hearing-ch7-02,
 *      case 26-10881 Patrick Doyle). Seeded case, never sent by
 *      simulate-feed, so it should classify, pass all gates, and fire both
 *      hearing automations.
 *   2. degraded-341.pdf   — a 341 meeting notice with realistic OCR damage:
 *      header intact, case number unreadable ("26-4l8?7"), chapter smudged,
 *      date partly illegible. Should land in Review (unmatched case at
 *      minimum), correctable by a human to 26-41877.
 *   3. farce.pdf          — a catering invoice. Not a court document at all:
 *      should classify as Other with low confidence and fire nothing.
 *
 * Output: demo-pdfs/ (gitignored). Usage:
 *   npx tsx scripts/make-demo-pdfs.ts            # deterministic content
 *   npx tsx scripts/make-demo-pdfs.ts --fresh    # appends a clerk-stamp line
 *                                                # so re-runs produce new
 *                                                # content hashes (ingestion
 *                                                # dedups identical text)
 *
 * Implementation notes — both quirks are pdf-parse (pdf.js 1.10) bugs the
 * upload route inherits:
 *   1. Classic PDF 1.4 layout (uncompressed streams, plain xref table):
 *      pdf.js 1.10 rejects the modern xref/object-stream layout that
 *      pdf-lib and most generators emit ("bad XRef entry").
 *   2. Files are comment-padded past 4 KB: pdf.js 1.10's fake worker
 *      re-clones Buffers through the deprecated Buffer() constructor, and
 *      Node pools sub-4KB allocations (byteOffset != 0), which pdf.js then
 *      misreads. Above 4 KB the clone gets dedicated memory and parses.
 * Text is ASCII only — OCR "damage" is spelled with l/0/?/# substitutions.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const OUT_DIR = join(__dirname, "..", "demo-pdfs");
const FRESH = process.argv.includes("--fresh");
const STAMP = FRESH ? `Clerk stamp ${new Date().toISOString()}` : null;

interface Line {
  text: string;
  size?: number;
  bold?: boolean;
  center?: boolean;
  gapBefore?: number;
}

const PAGE = { width: 612, height: 792, margin: 72 }; // US Letter, 1in margins

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Build a one-page classic PDF: catalog, pages, page, two Type1 standard
// fonts (regular + bold), one uncompressed content stream, plain xref.
function buildClassicPdf(
  lines: Line[],
  fonts: { regular: string; bold: string },
  file: string
) {
  const all = STAMP ? [...lines, { text: STAMP, size: 7, gapBefore: 24 }] : lines;

  let y = PAGE.height - PAGE.margin;
  const ops: string[] = [];
  for (const line of all) {
    const size = line.size ?? 11;
    y -= (line.gapBefore ?? 0) + size * 1.45;
    // No AFM metrics in a hand-built PDF; approximate centering at ~0.5em
    // average glyph width. Good enough for letter-styled demo documents.
    const x = line.center
      ? Math.max(PAGE.margin, (PAGE.width - line.text.length * size * 0.5) / 2)
      : PAGE.margin;
    const font = line.bold ? "/F2" : "/F1";
    ops.push(
      `BT ${font} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdfText(line.text)}) Tj ET`
    );
  }
  const content = ops.join("\n") + "\n";

  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
      `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /${fonts.regular} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /${fonts.bold} >>`,
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  // Pad above Node's 4 KB buffer-pool threshold (see header note 2).
  // PDF comments are ignored by parsers and produce no extracted text.
  const pad = "% " + "demo-pdf-padding ".repeat(4).trim() + "\n";
  while (pdf.length < 4600) pdf += pad;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  writeFileSync(join(OUT_DIR, file), Buffer.from(pdf, "ascii"));
  console.log(`wrote demo-pdfs/${file}`);
}

const courtFonts = { regular: "Times-Roman", bold: "Times-Bold" };
const invoiceFonts = { regular: "Helvetica", bold: "Helvetica-Bold" };

// 1 ─ Pristine hearing notice: text mirrors the hearing-ch7-02 eval example.
const cleanHearing: Line[] = [
  { text: "UNITED STATES BANKRUPTCY COURT", bold: true, size: 13, center: true },
  { text: "District of Massachusetts", center: true, gapBefore: 2 },
  { text: "In re: Patrick Doyle, Debtor", gapBefore: 28 },
  { text: "Case No. 26-10881-JEB         Chapter 7", gapBefore: 4 },
  { text: "NOTICE OF HEARING ON TRUSTEE'S MOTION TO SELL", bold: true, size: 12, center: true, gapBefore: 28 },
  { text: "A hearing on the Trustee's motion to sell estate property free and clear of", gapBefore: 22 },
  { text: "liens will be held on August 3, 2026 at 2:00 PM before the Honorable" },
  { text: "Janet E. Bostwick, John W. McCormack Post Office and Court House," },
  { text: "5 Post Office Square, Boston, MA." },
  { text: "Objections must be filed no later than seven days before the hearing.", gapBefore: 16 },
  { text: "BY THE COURT", gapBefore: 30 },
  { text: "Clerk of Court, District of Massachusetts", gapBefore: 4 },
];

// 2 ─ Degraded 341 notice: NEW document (not in the dataset). Recognizably a
// real court notice — header intact — but the case number, chapter, and
// meeting date carry OCR damage. A reviewer who pulls up the Carter case can
// plausibly correct "26-4l8?7" to 26-41877.
const degraded341: Line[] = [
  { text: "UNITED STATES BANKRUPTCY COURT", bold: true, size: 13, center: true },
  { text: "Eastern District of New Y0rk", center: true, gapBefore: 2 },
  { text: "In re: Dev0n C?rter, Debt0r", gapBefore: 28 },
  { text: "Case N0. 26-4l8?7-JMM         Chapter (smudged)", gapBefore: 4 },
  { text: "N0TICE OF MEETING OF CREDIT0RS", bold: true, size: 12, center: true, gapBefore: 28 },
  { text: "[scan quality: poor -- portions illegible]", size: 9, gapBefore: 14 },
  { text: "The meeting of creditors under 11 U.S.C. Secti0n 341(a) will be held 0n", gapBefore: 14 },
  { text: "J?ly 2#, 2026 at 1?:30 AM via teleph0nic appearance. Dial-in:" },
  { text: "(8??) 555-0l40, c0de 44#19?7." },
  { text: "The debt0r must appear and be examined under 0ath. Credit0rs may", gapBefore: 16 },
  { text: "attend but are n0t required t0 d0 s0." },
  { text: "[remainder of page water-damaged]", size: 9, gapBefore: 22 },
];

// 3 ─ The farce: a perfectly ordinary catering invoice.
const farce: Line[] = [
  { text: "TONY'S CATERING", bold: true, size: 18 },
  { text: "Brooklyn's finest empanadas since 1998", size: 9, gapBefore: 2 },
  { text: "INVOICE #88", bold: true, size: 13, gapBefore: 30 },
  { text: "Bill to: Hudson & Vance Bankruptcy Law", gapBefore: 14 },
  { text: "Re: Office party, Friday" },
  { text: "QTY   ITEM                                   PRICE", bold: true, gapBefore: 24 },
  { text: "40x   Beef empanadas                         $120.00" },
  { text: "20x   Chicken empanadas                      $60.00" },
  { text: "2x    Tres leches cake (full sheet)          $90.00" },
  { text: "1x    Delivery & setup                       $35.00" },
  { text: "TOTAL DUE: $305.00", bold: true, gapBefore: 18 },
  { text: "Payment due within 30 days. Thank you for your business!", gapBefore: 16 },
  { text: "Tony's Catering LLC - 412 Court St, Brooklyn NY - (718) 555-0144", size: 9, gapBefore: 24 },
];

mkdirSync(OUT_DIR, { recursive: true });
buildClassicPdf(cleanHearing, courtFonts, "clean-hearing.pdf");
buildClassicPdf(degraded341, courtFonts, "degraded-341.pdf");
buildClassicPdf(farce, invoiceFonts, "farce.pdf");
if (STAMP) console.log(`fresh mode: stamped "${STAMP}"`);
