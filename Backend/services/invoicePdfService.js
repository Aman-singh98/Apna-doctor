// services/invoicePdfService.js
//
// Renders a payment invoice (Patient Receipt / Doctor Invoice / Admin
// Invoice) as a PDF, printed on the real Apna Doctor Healthcare LLP
// letterhead artwork (assets/invoice-letterhead.jpg), so the exact same
// file can be downloaded from the admin panel today and, later, attached
// to an email/WhatsApp message sent straight to the patient or doctor —
// no separate "send" template needed, this IS the document.
//
// Layout: branded meta box, card-style "Bill To" / "Consultation" panels,
// a shaded striped line-item table with a bordered accent total row, and
// a signature block — the same professional format used for the
// stand-alone GST invoice format reference PDF.
//
// Data shape expected (`invoice` param) — see
// controllers/adminPaymentController.js `buildInvoiceData()`:
//   {
//     invoiceNumber, generatedAt, status, consultType, appointmentDate,
//     razorpayOrderId, razorpayPaymentId,
//     patient: { name, phone, email, bookedFor, relation },
//     doctor: { name, phone, specialization, qualification, regNumber, hospital, categoryLabel },
//     amounts: {
//       total, doctorShare, platformShare, doctorSplitPct, platformSplitPct,
//       patientGstPct, patientGstAmount, patientGrandTotal,
//       doctorGstPct, doctorGstAmount, doctorGrandTotal,   // doctorGrandTotal = doctorShare - GST (deducted, not added)
//     },
//     transaction: { status } | null,
//   }
//
// Usage:
//   const { streamInvoicePdf, buildInvoicePdfBuffer } = require('./invoicePdfService');
//   await streamInvoicePdf(res, invoice, 'patient');       // HTTP download
//   const buffer = await buildInvoicePdfBuffer(invoice, 'doctor'); // for emailing later

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const company = require('../config/companyConfig');
const { GSTIN_NUMBER, SAC_CODE } = require('../constants/gstConstants');

const LETTERHEAD_PATH = path.join(__dirname, '..', 'assets', 'invoice-letterhead.jpg');
const LETTERHEAD_AVAILABLE = fs.existsSync(LETTERHEAD_PATH);

// Natural pixel size of the letterhead artwork — used to work out the
// vertical band of blank space it leaves free (between the header block and
// the icon strip near the bottom) so invoice text never overlaps the design.
const LETTERHEAD_PX = { width: 1024, height: 1535 };
const SAFE_ZONE_PX = { top: 300, bottom: 1200 }; // blank band in the artwork

const PAGE = { width: 595.28, height: 841.89 }; // A4, points

const INK    = '#1c2b4a';
const MUTED  = '#5f6b7c';
const LINE   = '#dfe5ee';
const FILL   = '#f4f7fb';
const ACCENT = '#1a73e8';
const ACCENT_SOFT = '#eaf1fd';

function formatDateTime(d) {
   if (!d) return '—';
   return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatCurrency(n) {
   if (n == null) return '—';
   return `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Letterhead background + the safe content band it leaves free ──────────
function drawLetterhead(doc) {
   if (!LETTERHEAD_AVAILABLE) return null;

   const scale = PAGE.height / LETTERHEAD_PX.height;
   const drawWidth = LETTERHEAD_PX.width * scale;
   const offsetX = (PAGE.width - drawWidth) / 2;

   try {
      doc.image(LETTERHEAD_PATH, offsetX, 0, { width: drawWidth, height: PAGE.height });
   } catch (err) {
      return null; // corrupt/unreadable asset — caller falls back to a plain header
   }

   return {
      contentTop: SAFE_ZONE_PX.top * scale,
      contentBottom: SAFE_ZONE_PX.bottom * scale,
   };
}

// Plain-text fallback header, only used if the letterhead JPEG is ever
// missing from the deployment (keeps invoice generation from ever hard-failing).
function drawFallbackHeader(doc) {
   doc.rect(0, 0, PAGE.width, 64).fill(INK);
   doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(company.legalName, 48, 22);
   doc.fillColor('#c3cfe3').font('Helvetica').fontSize(9).text(
      `${company.tagline}  |  ${company.phone}  |  ${company.email}  |  ${company.website}`,
      48, 42
   );
   return 86;
}

const CONTENT_MARGIN_X = 58;
const CONTENT_WIDTH = PAGE.width - CONTENT_MARGIN_X * 2;

// ── Small drawing primitives ───────────────────────────────────────────────

// Shaded, rounded "meta" box: Invoice No / Date on one line, up to two more
// label/value pairs on a second line.
function metaBox(doc, y, fields) {
   const h = fields.length > 2 ? 36 : 22;
   doc.roundedRect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, h, 4).fill(FILL);
   doc.roundedRect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, h, 4).lineWidth(0.7).stroke(LINE);

   const half = CONTENT_WIDTH / 2;
   const rowsOf2 = [];
   for (let i = 0; i < fields.length; i += 2) rowsOf2.push(fields.slice(i, i + 2));

   rowsOf2.forEach((pair, ri) => {
      const rowY = y + 7 + ri * 14.5;
      pair.forEach(([label, value], ci) => {
         const x = CONTENT_MARGIN_X + 10 + ci * half;
         doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(label, x, rowY, { continued: true });
         doc.font('Helvetica-Bold').fontSize(9.3).fillColor(INK).text('  ' + value);
      });
   });

   return y + h + 12;
}

// Section title with a small accent bar, matching the stand-alone format PDF.
function sectionTitle(doc, y, text) {
   doc.rect(CONTENT_MARGIN_X, y + 1, 3, 11).fill(ACCENT);
   doc.font('Helvetica-Bold').fontSize(10).fillColor(ACCENT).text(text.toUpperCase(), CONTENT_MARGIN_X + 9, y);
   return y + 14;
}

// Bordered "card" of label/value rows — used for Bill To + Consultation Details.
function detailCard(doc, y, rows) {
   const rowH = 15;
   const h = rowH * rows.length + 7;
   doc.roundedRect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, h, 3).fill('#ffffff');
   doc.roundedRect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, h, 3).lineWidth(0.7).stroke(LINE);

   let ry = y + 7;
   rows.forEach(([label, value], i) => {
      doc.font('Helvetica-Bold').fontSize(8.6).fillColor(INK).text(label + ':', CONTENT_MARGIN_X + 10, ry, { continued: true });
      doc.font('Helvetica').fontSize(8.6).fillColor(MUTED).text('  ' + (value ?? '—'));
      if (i < rows.length - 1) {
         doc.moveTo(CONTENT_MARGIN_X, ry + 11).lineTo(PAGE.width - CONTENT_MARGIN_X, ry + 11).lineWidth(0.4).strokeColor(LINE).stroke();
      }
      ry += rowH;
   });

   return y + h + 10;
}

// A shaded-header, striped, bordered 2-column [description | amount]
// line-item table used for all three invoice kinds. `lines`: [{ label, sub, amount, bold, deduction }]
function drawAmountTable(doc, y, lines) {
   const descW = CONTENT_WIDTH * 0.68;
   const amtW = CONTENT_WIDTH - descW;
   const headerH = 20;

   // header
   doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, headerH).fill(INK);
   doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.6)
      .text('DESCRIPTION', CONTENT_MARGIN_X + 10, y + 6, { width: descW - 10 })
      .text('AMOUNT', CONTENT_MARGIN_X + descW, y + 6, { width: amtW - 10, align: 'right' });
   y += headerH;

   const top = y;
   lines.forEach((line, i) => {
      const rowH = line.sub ? 26 : 20;
      if (i % 2 === 1) doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, rowH).fill(FILL);

      doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.3).fillColor(line.deduction ? '#b3261e' : INK)
         .text(line.label, CONTENT_MARGIN_X + 10, y + 6, { width: descW - 18 });
      if (line.sub) {
         doc.font('Helvetica-Oblique').fontSize(7.2).fillColor(MUTED).text(line.sub, CONTENT_MARGIN_X + 10, y + 16.5, { width: descW - 18 });
      }
      const amountText = line.deduction ? `- ${line.amount}` : line.amount;
      doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.3).fillColor(line.deduction ? '#b3261e' : INK)
         .text(amountText, CONTENT_MARGIN_X + descW, y + 6, { width: amtW - 10, align: 'right' });

      doc.moveTo(CONTENT_MARGIN_X, y + rowH).lineTo(PAGE.width - CONTENT_MARGIN_X, y + rowH).lineWidth(0.4).strokeColor(LINE).stroke();
      y += rowH;
   });

   // outer + column borders
   doc.rect(CONTENT_MARGIN_X, top - headerH, CONTENT_WIDTH, (y - top) + headerH).lineWidth(0.8).stroke(LINE);
   doc.moveTo(CONTENT_MARGIN_X + descW, top - headerH).lineTo(CONTENT_MARGIN_X + descW, y).lineWidth(0.6).strokeColor(LINE).stroke();

   return y;
}

function drawGrandTotal(doc, y, label, amount) {
   const h = 26;
   doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, h).fill(ACCENT_SOFT);
   doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, h).lineWidth(0.9).stroke(ACCENT);
   doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
      .text(label, CONTENT_MARGIN_X + 10, y + 7, { width: CONTENT_WIDTH * 0.68 - 16 })
      .text(amount, CONTENT_MARGIN_X + CONTENT_WIDTH * 0.68, y + 7, { width: CONTENT_WIDTH * 0.32 - 10, align: 'right' });
   return y + h + 10;
}

function signatureBlock(doc, y) {
   doc.font('Helvetica').fontSize(8.6).fillColor(INK)
      .text(`for ${company.legalName}`, CONTENT_MARGIN_X, y, { width: CONTENT_WIDTH, align: 'right' });
   const lineY = y + 26;
   doc.moveTo(PAGE.width - CONTENT_MARGIN_X - 160, lineY).lineTo(PAGE.width - CONTENT_MARGIN_X, lineY).lineWidth(0.7).strokeColor(LINE).stroke();
   doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text('Authorized Signatory', CONTENT_MARGIN_X, lineY + 4, { width: CONTENT_WIDTH, align: 'right' });
   return lineY + 4;
}

// ── Main render dispatcher ─────────────────────────────────────────────────
function renderInvoice(doc, invoice, kind) {
   const zone = drawLetterhead(doc);
   let y = zone ? zone.contentTop : drawFallbackHeader(doc);

   const heading = {
      patient: 'PATIENT RECEIPT',
      doctor: 'DOCTOR INVOICE (Professional / Facilitation Fee)',
      admin: 'PLATFORM COMMISSION — INTERNAL STATEMENT',
   }[kind];

   doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(heading, CONTENT_MARGIN_X, y, { width: CONTENT_WIDTH });
   y = doc.y + 4;
   doc.moveTo(CONTENT_MARGIN_X, y).lineTo(PAGE.width - CONTENT_MARGIN_X, y).strokeColor(LINE).lineWidth(0.7).stroke();
   y += 12;

   // ── Invoice meta box (Invoice No / Date [/ GSTIN / SAC for doctor]) ────
   const metaFields = [['Invoice No.', invoice.invoiceNumber], ['Date', formatDateTime(invoice.generatedAt)]];
   if (kind === 'doctor' && GSTIN_NUMBER) metaFields.push(['GSTIN', GSTIN_NUMBER]);
   if (kind === 'doctor' && SAC_CODE) metaFields.push(['SAC Code', SAC_CODE]);
   y = metaBox(doc, y, metaFields);

   // ── Bill To ──────────────────────────────────────────────────────────
   y = sectionTitle(doc, y, kind === 'doctor' ? 'Invoice To (Doctor)' : 'Bill To (Patient)');
   const billRows = [];
   if (kind === 'doctor') {
      billRows.push(['Doctor', `Dr. ${invoice.doctor?.name || '—'}`]);
      if (invoice.doctor?.qualification) billRows.push(['Qualification', invoice.doctor.qualification]);
      if (invoice.doctor?.regNumber) billRows.push(['Reg. No.', invoice.doctor.regNumber]);
      if (invoice.doctor?.phone) billRows.push(['Phone', invoice.doctor.phone]);
   } else {
      billRows.push(['Patient', invoice.patient?.name || '—']);
      if (invoice.patient?.phone) billRows.push(['Phone', invoice.patient.phone]);
      if (invoice.patient?.bookedFor === 'Family Member') billRows.push(['Booked For', invoice.patient?.relation || 'Family Member']);
   }
   y = detailCard(doc, y, billRows);

   // ── Consultation ─────────────────────────────────────────────────────
   y = sectionTitle(doc, y, 'Consultation Details');
   const consultRows = [
      ['Consult Type', invoice.consultType || '—'],
      ['Appointment Date', formatDateTime(invoice.appointmentDate)],
   ];
   if (kind !== 'doctor') consultRows.push(['Doctor', invoice.doctor?.name ? `Dr. ${invoice.doctor.name}` : '—']);
   if (kind === 'doctor') consultRows.push(['Patient', invoice.patient?.name || '—']);
   if (invoice.razorpayPaymentId) consultRows.push(['Razorpay Payment ID', invoice.razorpayPaymentId]);
   y = detailCard(doc, y, consultRows);

   // ── Line items + GST ─────────────────────────────────────────────────
   const amt = invoice.amounts || {};

   if (kind === 'patient') {
      y = sectionTitle(doc, y, 'Amount');
      y = drawAmountTable(doc, y, [
         { label: 'Consultation Fee', sub: invoice.consultType ? `${invoice.consultType} consultation` : undefined, amount: formatCurrency(amt.total) },
         { label: `GST @ ${amt.patientGstPct ?? 0}%`, sub: 'Health-care services rendered by a doctor are exempt from GST.', amount: formatCurrency(amt.patientGstAmount ?? 0) },
      ]);
      y = drawGrandTotal(doc, y, 'Total Paid', formatCurrency(amt.patientGrandTotal ?? amt.total));
   }

   if (kind === 'doctor') {
      y = sectionTitle(doc, y, 'Fee Breakdown');
      const lines = [
         { label: 'Total Consultation Fee', amount: formatCurrency(amt.total) },
         {
            label: `Doctor Share${amt.doctorSplitPct != null ? ` (${amt.doctorSplitPct}%)` : ''}`,
            amount: formatCurrency(amt.doctorShare),
         },
      ];
      if (amt.doctorShare != null) {
         lines.push({
            label: `Less: GST @ ${amt.doctorGstPct ?? 18}%`,
            sub: 'Deducted from the doctor\u2019s settlement amount before payout — see disclaimer below.',
            amount: formatCurrency(amt.doctorGstAmount ?? 0),
            deduction: true,
         });
      }
      y = drawAmountTable(doc, y, lines);
      y = drawGrandTotal(doc, y, 'Net Payable to Doctor', formatCurrency(amt.doctorGrandTotal ?? amt.doctorShare));
   }

   if (kind === 'admin') {
      y = sectionTitle(doc, y, 'Commission Breakdown');
      y = drawAmountTable(doc, y, [
         { label: 'Total Consultation Fee', amount: formatCurrency(amt.total) },
         { label: `Platform Share${amt.platformSplitPct != null ? ` (${amt.platformSplitPct}%)` : ''}`, amount: formatCurrency(amt.platformShare) },
      ]);
      y = drawGrandTotal(doc, y, 'Platform Commission', formatCurrency(amt.platformShare));
   }

   // ── GST / GSTIN disclaimer ───────────────────────────────────────────
   if (kind !== 'admin') {
      let notice = GSTIN_NUMBER
         ? `GSTIN: ${GSTIN_NUMBER}. This is a computer-generated tax invoice.`
         : 'GSTIN not yet registered for Apna Doctor Healthcare LLP — the GST line above is for reference/estimation only and is not a tax invoice under the GST Act until a valid GSTIN is added.';
      if (kind === 'doctor') {
         notice += ' GST is withheld from the doctor\u2019s settlement (deducted, not added) — confirm this treatment with your CA.';
      }
      doc.font('Helvetica').fontSize(7.4).fillColor(MUTED).text(notice, CONTENT_MARGIN_X, y, { width: CONTENT_WIDTH });
      y = doc.y + 6;
   }

   // ── Signature ────────────────────────────────────────────────────────
   y = signatureBlock(doc, y + 4);

   doc.font('Helvetica').fontSize(7.1).fillColor(MUTED).text(
      `System-generated document from ${company.legalName} Admin Console — no physical signature required. Invoice ID: ${invoice.invoiceNumber}.`,
      CONTENT_MARGIN_X, y + 10, { width: CONTENT_WIDTH }
   );
}

// ── Public API ──────────────────────────────────────────────────────────

/** Streams the invoice PDF directly to an Express response (download). */
async function streamInvoicePdf(res, invoice, kind, filenameHint) {
   const doc = new PDFDocument({ size: 'A4', margin: 0 });
   const tag = { patient: 'patient-receipt', doctor: 'doctor-invoice', admin: 'admin-invoice' }[kind] || 'invoice';
   const filename = filenameHint || `${invoice.invoiceNumber}-${tag}.pdf`;

   res.setHeader('Content-Type', 'application/pdf');
   res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

   doc.pipe(res);
   renderInvoice(doc, invoice, kind);
   doc.end();
}

/**
 * Builds the invoice PDF fully in memory and resolves with a Buffer —
 * intended for future use (e.g. attaching to an email/WhatsApp message to
 * the patient or doctor) without needing an HTTP response to stream to.
 */
function buildInvoicePdfBuffer(invoice, kind) {
   return new Promise((resolve, reject) => {
      try {
         const doc = new PDFDocument({ size: 'A4', margin: 0 });
         const chunks = [];
         doc.on('data', (chunk) => chunks.push(chunk));
         doc.on('end', () => resolve(Buffer.concat(chunks)));
         doc.on('error', reject);
         renderInvoice(doc, invoice, kind);
         doc.end();
      } catch (err) {
         reject(err);
      }
   });
}

module.exports = { streamInvoicePdf, buildInvoicePdfBuffer };
