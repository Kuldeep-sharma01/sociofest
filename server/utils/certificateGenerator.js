import PDFDocument from "pdfkit";

// ✅ Sanitize all user-provided strings before passing to pdfkit
const sanitizePdfText = (str, maxLen = 500) =>
  String(str ?? '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // strip control chars
    .slice(0, maxLen)
    .trim();

/**
 * Generate a certificate PDF as a Buffer
 */
export const generateCertificatePDF = (certificate) => {
  return new Promise((resolve, reject) => {
    const recipientName = sanitizePdfText(certificate.user?.name, 100);
    const issuerName = sanitizePdfText(certificate.issuedBy?.name, 100);
    const certTitle = sanitizePdfText(certificate.title, 200);
    const certDesc = sanitizePdfText(
      certificate.description || `For successfully completing ${certTitle}.`,
      500,
    );

    // 📜 Set layout to landscape for a classic certificate look
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 50,
    });
    const buffers = [];

    // Collect data chunks natively
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const { width, height } = doc.page;

    // 🎨 Draw Outer Border
    doc
      .rect(30, 30, width - 60, height - 60)
      .fillAndStroke("#fdfdfd", "#1e3a8a") // Light background, Deep blue border
      .lineWidth(6)
      .stroke();

    // 🎨 Draw Inner Border
    doc
      .rect(40, 40, width - 80, height - 80)
      .lineWidth(1)
      .stroke("#1e3a8a");

    // 🏆 Header
    doc.moveDown(3);
    doc
      .font("Times-Bold")
      .fontSize(45)
      .fillColor("#1e3a8a")
      .text("CERTIFICATE", { align: "center" });

    doc
      .font("Times-Roman")
      .fontSize(20)
      .fillColor("#4b5563")
      .text("OF ACHIEVEMENT", { align: "center" });

    doc.moveDown(2);

    // 👤 Recipient Info
    doc
      .font("Times-Italic")
      .fontSize(18)
      .fillColor("#6b7280")
      .text("This is proudly presented to", { align: "center" });

    doc.moveDown(1);
    doc
      .font("Helvetica-Bold")
      .fontSize(36)
      .fillColor("#111827")
      .text(recipientName || "Student", { align: "center" });

    // Underline for the name
    const textWidth = doc.widthOfString(recipientName || "Student");
    const lineX = (width - textWidth) / 2;
    const lineY = doc.y + 5;
    doc
      .moveTo(lineX - 20, lineY)
      .lineTo(lineX + textWidth + 20, lineY)
      .lineWidth(1)
      .stroke("#d1d5db");

    doc.moveDown(2);

    // 📝 Certificate Description (Uses the dynamic score & dates built in the controller)
    doc
      .font("Times-Roman")
      .fontSize(16)
      .fillColor("#4b5563")
      .text(certDesc, 100,
        doc.y,
        {
          align: "center",
          width: width - 200,
          lineGap: 6,
        },
      );

    // ✍️ Footer Signatures & Date
    const footerY = height - 130;

    // Left Signature (Issuer)
    if (certificate.issuedBy) {
      doc
        .moveTo(100, footerY)
        .lineTo(300, footerY)
        .lineWidth(1)
        .stroke("#9ca3af");
      doc
        .font("Times-Bold")
        .fontSize(14)
        .fillColor("#374151")
        .text(issuerName || "Instructor", 100, footerY + 10, {
          width: 200,
          align: "center",
        });
      doc
        .font("Times-Roman")
        .fontSize(12)
        .fillColor("#6b7280")
        .text("Authorized Signature", 100, footerY + 30, {
          width: 200,
          align: "center",
        });
    }

    // Right Signature (Date)
    doc
      .moveTo(width - 300, footerY)
      .lineTo(width - 100, footerY)
      .lineWidth(1)
      .stroke("#9ca3af");

    // ✅ Guard the date rendering
    const issueDate = certificate.createdAt
      ? new Date(certificate.createdAt).toLocaleDateString()
      : new Date().toLocaleDateString();

    doc
      .font("Times-Bold")
      .fontSize(14)
      .fillColor("#374151")
      .text(issueDate, width - 300, footerY + 10, {
        width: 200,
        align: "center",
      });
    doc
      .font("Times-Roman")
      .fontSize(12)
      .fillColor("#6b7280")
      .text("Date of Issue", width - 300, footerY + 30, {
        width: 200,
        align: "center",
      });

    // 🏅 Center Badge/Seal
    const centerX = width / 2;
    const badgeY = footerY + 15;

    // Outer ring
    doc.circle(centerX, badgeY, 40).lineWidth(3).stroke("#fbbf24"); // Gold stroke
    // Inner fill
    doc.circle(centerX, badgeY, 34).fillAndStroke("#f59e0b", "#d97706"); // Bright orange fill, darker stroke

    // Badge Text
    doc
      .font("Times-Bold")
      .fontSize(10)
      .fillColor("#ffffff")
      .text("OFFICIAL", centerX - 25, badgeY - 10, {
        width: 50,
        align: "center",
      })
      .text("AWARD", centerX - 25, badgeY + 2, { width: 50, align: "center" });

    doc.end();
  });
};
