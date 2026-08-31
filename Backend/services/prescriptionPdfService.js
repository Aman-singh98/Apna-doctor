// services/prescriptionPdfService.js
//
// Renders a Prescription as a downloadable PDF slip. Field usage matches the
// REAL schemas in this repo:
//
//   Doctor: name, qualification, regNumber, hospital, specialization,
//           signatureUrl (Cloudinary image — used as the actual signature
//           if present, otherwise falls back to a signature line)
//           — NOTE: Doctor has no `email` field, don't populate/request it.
//
//   Patient: name, gender, dob (String 'DD-MM-YYYY'), bloodGroup
//
//   Prescription: patientName, patientPhone, diagnosis, chiefComplaints,
//                 allergies, medicalHistory, vitals: {bp,pulse,spo2,temp,rr,weight},
//                 medicines: [{ name, morning, afternoon, evening, night, unit,
//                               duration, instructions,
//                               // legacy fields, still rendered as a fallback
//                               // for prescriptions written before the M-A-E-N
//                               // grid existed:
//                               dosage, frequency }],
//                 notes, followUp, date, _id
//
// Deliberately OMITTED (no field exists anywhere in Appointment/Prescription
// for these — see models/Appointment.js "Minimal schema" note): appointment
// ID / consult type, ICD-10 code, investigations, QR code.
//
// Usage:
//   const { streamPrescriptionPdf } = require('./prescriptionPdfService');
//   await streamPrescriptionPdf(res, prescription); // prescription.doctor populated

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Real logo asset (cropped icon mark, square, transparent-safe on white bg).
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo-icon.png');
const LOGO_AVAILABLE = fs.existsSync(LOGO_PATH);

// ── Brand constants — swap for real logo asset whenever ready ─────────────
const BRAND = {
   name: 'ApnaDoctor',
   tagline: 'Online Consultation & Prescription',
   blue: '#1470af',
   orange: '#f5a623',
   green: '#1FA95C',
   darkText: '#222222',
   grayText: '#666666',
   lineGray: '#cccccc',
   headerFillGray: '#f2f2f2',
};

const PAGE_MARGIN = 40;
const IMAGE_FETCH_TIMEOUT_MS = 4000;

function formatDate(d) {
   const dt = d ? new Date(d) : new Date();
   return dt.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d) {
   const dt = d ? new Date(d) : new Date();
   return dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Patient.dob is stored as a free-text 'DD-MM-YYYY' string (see
// models/Patient.js), not a Date — parse defensively, return null on
// anything unexpected rather than throwing.
function ageFromDob(dobStr) {
   if (!dobStr || typeof dobStr !== 'string') return null;
   const parts = dobStr.split('-').map(Number);
   if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
   const [dd, mm, yyyy] = parts;
   const birth = new Date(yyyy, mm - 1, dd);
   if (Number.isNaN(birth.getTime())) return null;
   const today = new Date();
   let age = today.getFullYear() - birth.getFullYear();
   const monthDiff = today.getMonth() - birth.getMonth();
   if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
   return age >= 0 && age < 130 ? age : null;
}

// Best-effort fetch of the doctor's signature image (Cloudinary URL) as a
// Buffer for doc.image(). Never throws — callers fall back to a plain
// signature line if this returns null (missing URL, network hiccup,
// unsupported format, etc. should never break PDF generation).
async function fetchImageBuffer(url) {
   if (!url) return null;
   try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
   } catch (err) {
      return null;
   }
}

// ── Small drawing helpers ──────────────────────────────────────────────────

function drawLogo(doc, x, y) {
   const h = 40;
   if (LOGO_AVAILABLE) {
      try {
         doc.image(LOGO_PATH, x, y, { height: h, fit: [h, h] });
         return { width: h, height: h };
      } catch (err) {
         // Corrupt/unreadable asset — fall through to the text badge below.
      }
   }
   // Fallback wordmark badge, used only if the logo asset is missing.
   const w = 90, badgeH = 34;
   doc.roundedRect(x, y, w, badgeH, 6).fill(BRAND.orange);
   doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text('Apna', x, y + 8, { width: w, align: 'center' });
   doc.fillColor(BRAND.blue).font('Helvetica-Bold').fontSize(15).text('Doctor', x, y + 8 + 15, { width: w, align: 'center' });
   return { width: w, height: badgeH };
}

function sectionHeading(doc, text, x, y, width) {
   doc.fillColor(BRAND.darkText).font('Helvetica-Bold').fontSize(11).text(text, x, y, { width });
   return doc.y;
}

function bulletList(doc, items, x, y, width, opts = {}) {
   const bulletIndent = 10;
   doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.fontSize || 10).fillColor(BRAND.darkText);
   items.forEach((item) => {
      const curY = doc.y;
      doc.text('•', x, curY, { width: bulletIndent });
      doc.text(item, x + bulletIndent, curY, { width: width - bulletIndent });
      doc.moveDown(0.15);
   });
   return doc.y;
}

// Manual table renderer — pdfkit has no reliable native table API for this
// bordered/shaded grid style, so rows are laid out by hand.
// `columns`: [{ header, width, key }]
function drawTable(doc, { x, y, width, columns, rows }) {
   const rowPaddingY = 6;
   const rowPaddingX = 6;
   const headerHeight = 22;

   const drawHeaderRow = (hy) => {
      doc.rect(x, hy, width, headerHeight).fill(BRAND.headerFillGray);
      doc.fillColor(BRAND.darkText).font('Helvetica-Bold').fontSize(9.5);
      let hx = x;
      columns.forEach((col) => {
         doc.text(col.header, hx + rowPaddingX, hy + 6, { width: col.width - rowPaddingX * 2 });
         hx += col.width;
      });
      doc.rect(x, hy, width, headerHeight).stroke(BRAND.lineGray);
   };

   drawHeaderRow(y);
   let rowY = y + headerHeight;

   rows.forEach((row, idx) => {
      doc.font('Helvetica').fontSize(9);
      const cellHeights = columns.map((col) =>
         doc.heightOfString(String(row[col.key] ?? '—'), { width: col.width - rowPaddingX * 2 })
      );
      const rowHeight = Math.max(...cellHeights) + rowPaddingY * 2;

      if (rowY + rowHeight > doc.page.height - PAGE_MARGIN - 90) {
         doc.addPage();
         rowY = PAGE_MARGIN;
         drawHeaderRow(rowY);
         rowY += headerHeight;
      }

      if (idx % 2 === 1) {
         doc.rect(x, rowY, width, rowHeight).fill('#fafafa');
      }

      let cx = x;
      doc.font('Helvetica').fontSize(9).fillColor(BRAND.darkText);
      columns.forEach((col) => {
         const isFirst = col.key === columns[0].key;
         doc.text(isFirst ? `${idx + 1}. ${row[col.key] ?? '—'}` : String(row[col.key] ?? '—'), cx + rowPaddingX, rowY + rowPaddingY, {
            width: col.width - rowPaddingX * 2,
         });
         cx += col.width;
      });

      doc.rect(x, rowY, width, rowHeight).stroke(BRAND.lineGray);
      rowY += rowHeight;
   });

   return rowY;
}

// Medicines table with a Morning/Afternoon/Evening/Night dose grid per row.
// Falls back to the old free-text `dosage`/`frequency` string (as a single
// line under the medicine name) for any medicine that has no M-A-E-N values
// filled in — keeps prescriptions written before this field existed
// rendering sensibly instead of showing an empty grid.
function drawMedicinesTable(doc, { x, y, width, medicines }) {
   const rowPaddingX = 6;
   const headerHeight = 20;

   const colNo = 18;
   const colName = width * 0.30;
   const colGrid = width * 0.24;
   const colRoute = 0; // no dedicated route field in schema; folded into instructions
   const colTiming = width * 0.20;
   const colDuration = width - (colNo + colName + colGrid + colTiming);

   const drawHeader = (hy) => {
      doc.rect(x, hy, width, headerHeight).fill(BRAND.headerFillGray);
      doc.fillColor(BRAND.darkText).font('Helvetica-Bold').fontSize(8.5);
      let hx = x;
      [['#', colNo], ['Medicine', colName], ['M-A-E-N', colGrid], ['Instructions', colTiming], ['Duration', colDuration]].forEach(([label, w]) => {
         doc.text(label, hx + rowPaddingX, hy + 6, { width: w - rowPaddingX * 2 });
         hx += w;
      });
      doc.rect(x, hy, width, headerHeight).stroke(BRAND.lineGray);
   };

   drawHeader(y);
   let rowY = y + headerHeight;
   const gridLabels = ['M', 'A', 'E', 'N'];

   medicines.forEach((m, idx) => {
      const hasGrid = m.morning || m.afternoon || m.evening || m.night;
      const legacyLine = !hasGrid && (m.dosage || m.frequency)
         ? [m.dosage, m.frequency].filter(Boolean).join(' · ')
         : '';
      // Salt composition rendered as a second line under the (brand) name,
      // e.g. "Aquris Livz M Tablet" / "Levocetirizine 5mg + Montelukast 10mg".
      const compositionLine = (m.composition || '').trim();

      doc.font('Helvetica-Bold').fontSize(9);
      const nameHeight = doc.heightOfString(m.name || '—', { width: colName - rowPaddingX * 2 });
      doc.font('Helvetica').fontSize(7.5);
      const compositionHeight = compositionLine ? doc.heightOfString(compositionLine, { width: colName - rowPaddingX * 2 }) + 2 : 0;
      const legacyHeight = legacyLine ? doc.heightOfString(legacyLine, { width: colName - rowPaddingX * 2 }) + 2 : 0;
      doc.font('Helvetica').fontSize(8);
      const instrHeight = doc.heightOfString(m.instructions || '—', { width: colTiming - rowPaddingX * 2 });
      const rowHeight = Math.max(nameHeight + compositionHeight + legacyHeight, 26, instrHeight) + 14;

      if (rowY + rowHeight > doc.page.height - PAGE_MARGIN - 90) {
         doc.addPage();
         rowY = PAGE_MARGIN;
         drawHeader(rowY);
         rowY += headerHeight;
      }

      if (idx % 2 === 1) {
         doc.rect(x, rowY, width, rowHeight).fill('#fafafa');
      }

      let cx = x;
      doc.fillColor(BRAND.darkText).font('Helvetica').fontSize(9);
      doc.text(String(idx + 1), cx + rowPaddingX, rowY + 7, { width: colNo - rowPaddingX * 2 });
      cx += colNo;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.darkText).text(m.name || '—', cx + rowPaddingX, rowY + 7, { width: colName - rowPaddingX * 2 });
      let belowNameY = rowY + 7 + nameHeight + 2;
      if (compositionLine) {
         doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.grayText).text(compositionLine, cx + rowPaddingX, belowNameY, { width: colName - rowPaddingX * 2 });
         belowNameY += compositionHeight;
      }
      if (legacyLine) {
         doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.grayText).text(legacyLine, cx + rowPaddingX, belowNameY, { width: colName - rowPaddingX * 2 });
      }
      cx += colName;

      if (hasGrid) {
         const cellW = colGrid / 4;
         const values = [m.morning, m.afternoon, m.evening, m.night];
         values.forEach((val, i) => {
            const gx = cx + i * cellW;
            doc.font('Helvetica').fontSize(7).fillColor(BRAND.grayText).text(gridLabels[i], gx, rowY + 6, { width: cellW, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(val ? BRAND.green : BRAND.lineGray).text(val || '0', gx, rowY + 16, { width: cellW, align: 'center' });
         });
      } else {
         doc.font('Helvetica').fontSize(8).fillColor(BRAND.grayText).text('—', cx + rowPaddingX, rowY + 12, { width: colGrid - rowPaddingX * 2 });
      }
      cx += colGrid;

      doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.darkText).text(m.instructions || '—', cx + rowPaddingX, rowY + 7, { width: colTiming - rowPaddingX * 2 });
      cx += colTiming;

      doc.text(m.duration || '—', cx + rowPaddingX, rowY + 7, { width: colDuration - rowPaddingX * 2 });

      doc.rect(x, rowY, width, rowHeight).stroke(BRAND.lineGray);
      rowY += rowHeight;
   });

   return rowY;
}

// ── Main render function ───────────────────────────────────────────────────

async function renderPrescription(doc, prescription) {
   const pageWidth = doc.page.width - PAGE_MARGIN * 2;
   const doctor = prescription.doctor || {};
   const patient = prescription.patientProfile || {}; // optional enrichment, see controllers

   const doctorName = doctor.name || 'Doctor';
   const doctorQualification = doctor.qualification || '';
   const doctorSpecialization = doctor.specialization || '';
   const doctorRegNumber = doctor.regNumber || '';
   const doctorHospital = doctor.hospital || '';

   // ── Header ────────────────────────────────────────────────────────────
   const headerTop = PAGE_MARGIN;
   const { width: logoW, height: logoH } = drawLogo(doc, PAGE_MARGIN, headerTop);
   const textColX = PAGE_MARGIN + logoW + 12;

   doc.fillColor(BRAND.blue).font('Helvetica-Bold').fontSize(13).text(`Dr. ${doctorName}`, textColX, headerTop, { width: 260 });
   const credentialLine = [doctorQualification, doctorSpecialization].filter(Boolean).join(' · ');
   if (credentialLine) {
      doc.fillColor(BRAND.grayText).font('Helvetica').fontSize(9.5).text(credentialLine, textColX, doc.y + 2, { width: 260 });
   }
   if (doctorRegNumber) {
      doc.fillColor(BRAND.grayText).font('Helvetica').fontSize(8.5).text(`Reg. No. ${doctorRegNumber}`, textColX, doc.y + 2, { width: 260 });
   }

   // Right-aligned brand / clinic block
   const rightColX = PAGE_MARGIN + pageWidth - 220;
   doc.fillColor(BRAND.darkText).font('Helvetica-Bold').fontSize(10).text(BRAND.name, rightColX, headerTop, { width: 220, align: 'right' });
   doc.fillColor(BRAND.grayText).font('Helvetica').fontSize(9).text(doctorHospital || BRAND.tagline, rightColX, doc.y + 2, { width: 220, align: 'right' });
   if (doctor.phone) {
      doc.text(`Phone: ${doctor.phone}`, rightColX, doc.y + 2, { width: 220, align: 'right' });
   }

   let y = Math.max(headerTop + logoH, doc.y) + 12;
   doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth, y).strokeColor(BRAND.lineGray).stroke();
   y += 16;

   // ── Patient block ─────────────────────────────────────────────────────
   // Left (patient details) and right (date/time) columns can each wrap to
   // a different number of lines, so track their bottoms independently —
   // doc.y is a single shared cursor and the LAST text() call wins if we
   // don't do this, which previously let a short right column clobber a
   // taller left column (Diagnosis heading overlapping Blood Group).
   sectionHeading(doc, 'Patient', PAGE_MARGIN, y, 300);
   doc.font('Helvetica').fontSize(10).fillColor(BRAND.darkText);
   doc.text(prescription.patientName || '—', PAGE_MARGIN, doc.y + 2);

   const age = ageFromDob(patient.dob);
   const demographicBits = [patient.gender, age != null ? `${age} Yrs` : null].filter(Boolean).join(', ');
   if (demographicBits) {
      doc.fillColor(BRAND.grayText).fontSize(9.5).text(demographicBits, PAGE_MARGIN, doc.y + 1);
   }
   if (prescription.patientPhone) {
      doc.fillColor(BRAND.darkText).fontSize(10).text(`Mobile: ${prescription.patientPhone}`, PAGE_MARGIN, doc.y + 2);
   }
   if (patient.bloodGroup) {
      doc.fillColor(BRAND.grayText).fontSize(9.5).text(`Blood Group: ${patient.bloodGroup}`, PAGE_MARGIN, doc.y + 1);
   }
   const leftBottomY = doc.y;

   doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.darkText).text(`Date: ${formatDate(prescription.date)}`, rightColX, y, { width: 220, align: 'right' });
   doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.grayText).text(`Time: ${formatTime(prescription.date)}`, rightColX, doc.y + 2, { width: 220, align: 'right' });
   if (prescription._id) {
      doc.text(`Rx ID: ${String(prescription._id).slice(-8).toUpperCase()}`, rightColX, doc.y + 2, { width: 220, align: 'right' });
   }
   const rightBottomY = doc.y;

   y = Math.max(leftBottomY, rightBottomY) + 18;

   // ── Chief Complaints ─────────────────────────────────────────────────
   const complaintItems = (prescription.chiefComplaints || '').split('\n').map((s) => s.trim()).filter(Boolean);
   if (complaintItems.length) {
      y = sectionHeading(doc, 'Chief Complaints', PAGE_MARGIN, y, pageWidth);
      doc.moveDown(0.3);
      y = bulletList(doc, complaintItems, PAGE_MARGIN, doc.y, pageWidth) + 12;
   }

   // ── Allergy & Relevant History (stacked, one line per field) ──────────
   {
      y = sectionHeading(doc, 'Allergy & Relevant History', PAGE_MARGIN, y, pageWidth);
      doc.moveDown(0.2);
      const historyRows = [
         ['Drug Allergies: ', prescription.allergies || 'No'],
         ['Diet Restrictions: ', prescription.dietRestrictions || 'No'],
         ['Medical History: ', prescription.medicalHistory || 'None reported'],
      ];
      historyRows.forEach(([label, value]) => {
         const rowY = doc.y;
         doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BRAND.darkText).text(label, PAGE_MARGIN, rowY, { continued: true });
         doc.font('Helvetica').fillColor(BRAND.grayText).text(value, { width: pageWidth - doc.widthOfString(label) });
         doc.moveDown(0.15);
      });
      y = doc.y + 10;
   }

   // ── Vitals (only the fields the doctor actually filled) ──────────────
   const vitals = prescription.vitals || {};
   const vitalEntries = [
      ['BP', vitals.bp], ['Pulse', vitals.pulse], ['SpO2', vitals.spo2],
      ['Temp', vitals.temp], ['RR', vitals.rr], ['Weight', vitals.weight],
   ].filter(([, val]) => !!val);
   if (vitalEntries.length) {
      const vHeadingY = y;
      doc.fillColor(BRAND.darkText).font('Helvetica-Bold').fontSize(11).text('Vitals ', PAGE_MARGIN, vHeadingY, { continued: true, width: pageWidth });
      doc.font('Helvetica').fontSize(9).fillColor(BRAND.grayText).text('(As declared by patient)');
      y = doc.y;
      doc.moveDown(0.2);
      const vColW = pageWidth / vitalEntries.length;
      const vTopY = doc.y;
      vitalEntries.forEach(([label, val], i) => {
         const vx = PAGE_MARGIN + i * vColW;
         doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.grayText).text(label, vx, vTopY);
         doc.font('Helvetica').fontSize(10).fillColor(BRAND.darkText).text(val, vx, vTopY + 12);
      });
      y = vTopY + 26 + 16;
   }

   // ── Diagnosis ─────────────────────────────────────────────────────────
   sectionHeading(doc, 'Diagnosis / Provisional Diagnosis', PAGE_MARGIN, y, pageWidth);
   doc.moveDown(0.3);
   const diagnosisItems = (prescription.diagnosis || '—').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
   bulletList(doc, diagnosisItems.length ? diagnosisItems : ['—'], PAGE_MARGIN, doc.y, pageWidth);

   y = doc.y + 14;

   // ── Medication table (Morning / Afternoon / Evening / Night grid) ─────
   sectionHeading(doc, 'Medicines Prescribed', PAGE_MARGIN, y, pageWidth);
   y = doc.y + 8;

   y = drawMedicinesTable(doc, {
      x: PAGE_MARGIN,
      y,
      width: pageWidth,
      medicines: prescription.medicines && prescription.medicines.length ? prescription.medicines : [{ name: '—' }],
   });
   doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.grayText).text(
      'M-A-E-N: Morning · Afternoon · Evening · Night dose. Medicine substitution allowed wherever applicable.',
      PAGE_MARGIN, y
   );
   y = doc.y + 14;

   // ── Advice & follow-up ────────────────────────────────────────────────
   if (y > doc.page.height - PAGE_MARGIN - 140) {
      doc.addPage();
      y = PAGE_MARGIN;
   }

   const adviceItems = (prescription.notes || '').split('\n').map((s) => s.trim()).filter(Boolean);
   if (prescription.followUp) {
      adviceItems.push(`Follow-up: ${prescription.followUp}`);
   }
   if (adviceItems.length) {
      sectionHeading(doc, 'Advice & Instructions', PAGE_MARGIN, y, pageWidth);
      doc.moveDown(0.3);
      bulletList(doc, adviceItems, PAGE_MARGIN, doc.y, pageWidth);
      y = doc.y + 20;
   }

   // ── Signature ─────────────────────────────────────────────────────────
   if (y > doc.page.height - PAGE_MARGIN - 110) {
      doc.addPage();
      y = PAGE_MARGIN;
   }
   const sigBoxWidth = 200;
   const sigX = PAGE_MARGIN + pageWidth - sigBoxWidth;

   const signatureBuffer = await fetchImageBuffer(doctor.signatureUrl);
   if (signatureBuffer) {
      try {
         doc.image(signatureBuffer, sigX + sigBoxWidth / 2 - 50, y, { width: 100, height: 40, fit: [100, 40] });
      } catch (err) {
         // Corrupt/unsupported image data — fall through to the blank line below.
      }
   }
   doc.moveTo(sigX, y + 44).lineTo(sigX + sigBoxWidth, y + 44).strokeColor(BRAND.lineGray).stroke();
   doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.darkText).text(`Dr. ${doctorName}`, sigX, y + 48, { width: sigBoxWidth, align: 'center' });
   if (credentialLine) {
      doc.font('Helvetica').fontSize(9).fillColor(BRAND.grayText).text(credentialLine, sigX, doc.y + 1, { width: sigBoxWidth, align: 'center' });
   }
   doc.font('Helvetica').fontSize(8).fillColor(BRAND.grayText).text('SIGNATURE', sigX, doc.y + 4, { width: sigBoxWidth, align: 'center' });

   y = doc.y + 22;

   // ── Disclaimer footer ─────────────────────────────────────────────────
   doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth, y).strokeColor(BRAND.lineGray).stroke();
   y += 8;
   doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.grayText).text(
      `Disclaimer: This prescription was generated digitally by Dr. ${doctorName}${doctorRegNumber ? ` (Reg. No. ${doctorRegNumber})` : ''} on ${formatDate(
         prescription.date
      )} via ${BRAND.name}, based on the tele-consultation. It is valid from the date of issue for the specific period/dosage of each medicine as advised. Prescription ID: ${prescription._id || '—'}`,
      PAGE_MARGIN,
      y,
      { width: pageWidth }
   );
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Streams a generated prescription PDF directly to an Express response.
 * `prescription.doctor` should be populated with:
 *   'name qualification regNumber hospital specialization signatureUrl phone'
 * `prescription.patientProfile` (optional) can carry { gender, dob, bloodGroup }
 * for a fuller patient line when the caller already has that Patient doc.
 */
async function streamPrescriptionPdf(res, prescription, filenameHint) {
   const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
   const filename = filenameHint || `prescription-${prescription._id || 'slip'}.pdf`;

   res.setHeader('Content-Type', 'application/pdf');
   res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

   doc.pipe(res);
   await renderPrescription(doc, prescription);
   doc.end();
}

/** Writes the PDF to a local file path — handy for testing/previewing. */
async function writePrescriptionPdfToFile(prescription, filePath) {
   const fs = require('fs');
   return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      try {
         await renderPrescription(doc, prescription);
         doc.end();
      } catch (err) {
         reject(err);
         return;
      }
      stream.on('finish', resolve);
      stream.on('error', reject);
   });
}

module.exports = { streamPrescriptionPdf, writePrescriptionPdfToFile };
