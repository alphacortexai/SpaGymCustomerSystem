import jsPDF from 'jspdf';

const DEFAULT_GYM_COMPLIMENTARIES =
  'Complimentary health drinks, tea and snacks, swimming, steam bath and sauna.';
const DEFAULT_SPA_COMPLIMENTARIES =
  'Health drinks and Tea, Juices, Fruit Salad and many more';

/**
 * Generate a PDF data URI from a saved invoice object (from Firestore).
 * @param {Object} invoice - { invoiceNumber, invoiceDate, clientName, company, phone, experienceType, serviceType, membership, customItem, customAmount, customComplimentaries, currency, qty, totalAmount }
 * @returns {Promise<string>} - Data URI of the PDF
 */
export function generateInvoicePdf(invoice) {
  return new Promise((resolve) => {
    const {
      invoiceNumber,
      invoiceDate,
      clientName,
      company,
      phone,
      experienceType,
      serviceType,
      membership,
      membershipName,
      customItem,
      customComplimentaries,
      currency,
      qty = 1,
      totalAmount,
    } = invoice;

    const unitAmount = totalAmount != null && Number(qty) ? Number(totalAmount) / Number(qty) : 0;
    const itemDescription = membershipName || customItem || membership || '';
    const complimentariesText = customComplimentaries ||
      (serviceType === 'Spa'
        ? DEFAULT_SPA_COMPLIMENTARIES
        : DEFAULT_GYM_COMPLIMENTARIES);

    let template = '/invoice_templateA.png';
    if (experienceType === 'Soothing') {
      template = '/invoice_templateB.png';
    } else if (experienceType === 'Positive' && currency === 'UGX') {
      template = '/invoice_templateC.png';
    }

    const displaySymbol =
      experienceType === 'Positive' && serviceType === 'Gym' && currency === 'USD'
        ? '$'
        : currency === 'UGX'
          ? 'UGX '
          : '$';

    const pdfDoc = new jsPDF();
    const img = new Image();

    const renderContent = () => {
      pdfDoc.setFontSize(12);
      pdfDoc.text(String(invoiceNumber ?? '—'), 163, 77);
      pdfDoc.text(String(invoiceDate ?? ''), 163, 84);
      pdfDoc.text(String(clientName ?? ''), 15, 76);
      pdfDoc.text(String(company ?? ''), 15, 82);
      pdfDoc.text(String(phone ?? ''), 15, 89);
      pdfDoc.text(String(qty ?? 1), 20, 110);
      pdfDoc.text(itemDescription, 32, 110);
      pdfDoc.text(`${displaySymbol}${Number(unitAmount).toLocaleString()}`, 125, 110);
      pdfDoc.text(`${displaySymbol}${Number(totalAmount || 0).toLocaleString()}`, 162, 110);
      pdfDoc.text('Complimentaries:', 32, 140);
      pdfDoc.text(complimentariesText, 32, 145, { maxWidth: 100 });
      pdfDoc.text(`${displaySymbol}${Number(totalAmount || 0).toLocaleString()}`, 162, 220);
    };

    img.onload = () => {
      pdfDoc.addImage(img, 'PNG', 0, 0, 210, 297);
      renderContent();
      resolve(pdfDoc.output('datauristring'));
    };
    img.onerror = () => {
      renderContent();
      resolve(pdfDoc.output('datauristring'));
    };
    img.src = template;
  });
}
