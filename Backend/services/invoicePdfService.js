// services/invoicePdfService.js
//
// Renders a payment invoice (Patient Receipt / Doctor Invoice / Admin
// Invoice) as a PDF, printed on the real Apna Doctor Healthcare LLP
// letterhead artwork (assets/invoice-letterhead.jpg), so the exact same
// file can be downloaded from the admin panel today and, later, attached
// to an email/WhatsApp message sent straight to the patient or doctor —
// no separate "send" template needed, this IS the document.
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
//       doctorGstPct, doctorGstAmount, doctorGrandTotal,
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

const INK = '#1c2b4a';
const MUTED = '#5f6b7c';
const LINE = '#e4e9f0';
const ACCENT = '#1a73e8';

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
   doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(company.legalName, 48, 40);
   doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(
      `${company.tagline}  |  ${company.phone}  |  ${company.email}  |  ${company.website}`,
      48, 60
   );
   doc.moveTo(48, 84).lineTo(PAGE.width - 48, 84).strokeColor(LINE).stroke();
   return 100;
}

const CONTENT_MARGIN_X = 58;
const CONTENT_WIDTH = PAGE.width - CONTENT_MARGIN_X * 2;

function row(doc, y, label, value, opts = {}) {
   doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(label, CONTENT_MARGIN_X, y, { width: CONTENT_WIDTH * 0.5 });
   doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(INK)
      .text(String(value ?? '—'), CONTENT_MARGIN_X + CONTENT_WIDTH * 0.5, y, { width: CONTENT_WIDTH * 0.5, align: 'right' });
   return y + 16;
}

function sectionTitle(doc, y, text) {
   doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ACCENT).text(text, CONTENT_MARGIN_X, y);
   return y + 16;
}

// A simple 2-column [description | amount] line-item table used for all
// three invoice kinds. `lines`: [{ label, sub, amount, bold }]
function drawAmountTable(doc, y, lines) {
   const descW = CONTENT_WIDTH * 0.68;
   const amtW = CONTENT_WIDTH - descW;

   // header
   doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, 20).fill('#f2f5fa');
   doc.fillColor(INK).font('Helvetica-Bold').fontSize(9)
      .text('DESCRIPTION', CONTENT_MARGIN_X + 8, y + 6, { width: descW - 8 })
      .text('AMOUNT', CONTENT_MARGIN_X + descW, y + 6, { width: amtW - 8, align: 'right' });
   doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, 20).stroke(LINE);
   y += 20;

   lines.forEach((line) => {
      const rowH = line.sub ? 30 : 20;
      doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(INK)
         .text(line.label, CONTENT_MARGIN_X + 8, y + 6, { width: descW - 16 });
      if (line.sub) {
         doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(line.sub, CONTENT_MARGIN_X + 8, y + 18, { width: descW - 16 });
      }
      doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(INK)
         .text(line.amount, CONTENT_MARGIN_X + descW, y + 6, { width: amtW - 8, align: 'right' });
      doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, rowH).stroke(LINE);
      y += rowH;
   });

   return y;
}

function drawGrandTotal(doc, y, label, amount) {
   doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, 26).fill('#eaf1fd');
   doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
      .text(label, CONTENT_MARGIN_X + 8, y + 7, { width: CONTENT_WIDTH * 0.68 - 16 })
      .text(amount, CONTENT_MARGIN_X + CONTENT_WIDTH * 0.68, y + 7, { width: CONTENT_WIDTH * 0.32 - 8, align: 'right' });
   doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, 26).stroke(LINE);
   return y + 26;
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
   doc.moveTo(CONTENT_MARGIN_X, y).lineTo(PAGE.width - CONTENT_MARGIN_X, y).strokeColor(LINE).stroke();
   y += 10;

   // ── Invoice meta (two columns) ─────────────────────────────────────────
   const metaLeftY = y, metaRightY = y;
   doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Invoice No.', CONTENT_MARGIN_X, metaLeftY);
   doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(invoice.invoiceNumber, CONTENT_MARGIN_X, metaLeftY + 12);

   doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Date', CONTENT_MARGIN_X + CONTENT_WIDTH - 160, metaRightY, { width: 160, align: 'right' });
   doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(formatDateTime(invoice.generatedAt), CONTENT_MARGIN_X + CONTENT_WIDTH - 160, metaRightY + 12, { width: 160, align: 'right' });

   y += 34;

   if (kind === 'doctor' && GSTIN_NUMBER) {
      y = row(doc, y, 'GSTIN', GSTIN_NUMBER);
   }
   if (kind === 'doctor' && SAC_CODE) {
      y = row(doc, y, 'SAC Code', SAC_CODE);
   }

   y += 4;

   // ── Bill To ──────────────────────────────────────────────────────────
   y = sectionTitle(doc, y, kind === 'doctor' ? 'Invoice To (Doctor)' : 'Bill To (Patient)');
   if (kind === 'doctor') {
      y = row(doc, y, 'Doctor', `Dr. ${invoice.doctor?.name || '—'}`);
      if (invoice.doctor?.qualification) y = row(doc, y, 'Qualification', invoice.doctor.qualification);
      if (invoice.doctor?.regNumber) y = row(doc, y, 'Reg. No.', invoice.doctor.regNumber);
      if (invoice.doctor?.phone) y = row(doc, y, 'Phone', invoice.doctor.phone);
   } else {
      y = row(doc, y, 'Patient', invoice.patient?.name || '—');
      if (invoice.patient?.phone) y = row(doc, y, 'Phone', invoice.patient.phone);
      if (invoice.patient?.bookedFor === 'Family Member') y = row(doc, y, 'Booked For', `${invoice.patient?.relation || 'Family Member'}`);
   }
   y += 6;

   // ── Consultation ─────────────────────────────────────────────────────
   y = sectionTitle(doc, y, 'Consultation Details');
   y = row(doc, y, 'Consult Type', invoice.consultType || '—');
   y = row(doc, y, 'Appointment Date', formatDateTime(invoice.appointmentDate));
   if (kind !== 'doctor') y = row(doc, y, 'Doctor', invoice.doctor?.name ? `Dr. ${invoice.doctor.name}` : '—');
   if (kind === 'doctor') y = row(doc, y, 'Patient', invoice.patient?.name || '—');
   if (invoice.razorpayPaymentId) y = row(doc, y, 'Razorpay Payment ID', invoice.razorpayPaymentId);
   y += 6;

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
            label: `GST @ ${amt.doctorGstPct ?? 18}%`,
            sub: 'Professional / facilitation fee — see disclaimer below.',
            amount: formatCurrency(amt.doctorGstAmount ?? 0),
         });
      }
      y = drawAmountTable(doc, y, lines);
      y = drawGrandTotal(doc, y, 'Total Payable', formatCurrency(amt.doctorGrandTotal ?? amt.doctorShare));
   }

   if (kind === 'admin') {
      y = sectionTitle(doc, y, 'Commission Breakdown');
      y = drawAmountTable(doc, y, [
         { label: 'Total Consultation Fee', amount: formatCurrency(amt.total) },
         { label: `Platform Share${amt.platformSplitPct != null ? ` (${amt.platformSplitPct}%)` : ''}`, amount: formatCurrency(amt.platformShare) },
      ]);
      y = drawGrandTotal(doc, y, 'Platform Commission', formatCurrency(amt.platformShare));
   }

   y += 14;

   // ── GST / GSTIN disclaimer ───────────────────────────────────────────
   if (kind !== 'admin') {
      const notice = GSTIN_NUMBER
         ? `GSTIN: ${GSTIN_NUMBER}. This is a computer-generated tax invoice.`
         : 'GSTIN not yet registered for Apna Doctor Healthcare LLP — the GST line above is shown for reference/estimation only and does not constitute a tax invoice under the GST Act until a valid GSTIN is added.';
      doc.font('Helvetica').fontSize(7.8).fillColor(MUTED).text(notice, CONTENT_MARGIN_X, y, { width: CONTENT_WIDTH });
      y = doc.y + 10;
   }

   doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(
      `This is a system-generated document from ${company.legalName} Admin Console and does not require a physical signature. Invoice ID: ${invoice.invoiceNumber}.`,
      CONTENT_MARGIN_X, y, { width: CONTENT_WIDTH }
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
