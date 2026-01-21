'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

export default function InvoiceGenerator() {
  const [step, setStep] = useState(1);
  const [branch, setBranch] = useState('Positive');
  const [clientName, setClientName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [experienceType, setExperienceType] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [membership, setMembership] = useState('');
  const [customItem, setCustomItem] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customComplimentaries, setCustomComplimentaries] = useState('');
  const [qty, setQty] = useState(1);
  const [pdfPreview, setPdfPreview] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(null);
  const [invoiceDate] = useState(new Date().toLocaleDateString());

  const membershipPrices = {
    'Annual Individual GYM Membership': 1300,
    'Annual Family GYM Membership': 1800,
    'Half Year GYM Membership Subscription': 800,
  };

  const defaultGymComplimentaries =
    'Complimentary health drinks, tea and snacks, swimming, steam bath and sauna.';
  const defaultSpaComplimentaries =
    'Health drinks and Tea, Juices, Fruit Salad and many more';

  const computedCustomAmount = parseFloat(customAmount) || 0;
  const unitAmount =
    experienceType === 'Positive' && serviceType === 'Gym'
      ? currency === 'UGX'
        ? computedCustomAmount > 0
          ? computedCustomAmount
          : membership
            ? membershipPrices[membership] || 0
            : 0
        : membership
          ? membershipPrices[membership] || 0
          : computedCustomAmount || 0
      : computedCustomAmount || 0;

  const totalAmount = unitAmount * qty;

  /** @param {boolean} consume - If true, increment counter and return new number. If false, return current without incrementing (for preview). */
  const getInvoiceNumber = async (consume = false) => {
    const invoiceCounterRef = doc(db, 'counters', 'invoiceCounter');
    let result = null;
    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(invoiceCounterRef);
      if (!counterDoc.exists()) {
        result = 100000;
        transaction.set(invoiceCounterRef, { current: result });
      } else {
        const current = counterDoc.data().current;
        if (consume) {
          result = current + 1;
          transaction.update(invoiceCounterRef, { current: result });
        } else {
          result = current;
        }
      }
    });
    return result;
  };

  const saveInvoiceDetails = async (invoiceData) => {
    try {
      await addDoc(collection(db, 'invoices'), invoiceData);
    } catch (error) {
      console.error('Error saving invoice: ', error);
    }
  };

  const renderInvoiceContent = async (pdfDoc, displaySymbol, overrideNum) => {
    const num =
      overrideNum != null ? overrideNum : await getInvoiceNumber(false);
    pdfDoc.setFontSize(12);
    pdfDoc.text(`${num ?? '...'}`, 163, 77);
    pdfDoc.text(`${invoiceDate}`, 163, 84);
    pdfDoc.text(`${clientName}`, 15, 76);
    pdfDoc.text(`${company}`, 15, 82);
    pdfDoc.text(`${phone}`, 15, 89);
    pdfDoc.text(`${qty}`, 20, 110);
    const itemDescription =
      experienceType === 'Positive' && serviceType === 'Gym' && membership
        ? membership
        : customItem;
    pdfDoc.text(itemDescription, 32, 110);
    pdfDoc.text(`${displaySymbol}${unitAmount.toLocaleString()}`, 125, 110);
    pdfDoc.text(`${displaySymbol}${totalAmount.toLocaleString()}`, 162, 110);
    const complimentariesText =
      experienceType === 'Positive' && serviceType === 'Gym' && membership
        ? defaultGymComplimentaries
        : serviceType === 'Spa'
          ? customComplimentaries || defaultSpaComplimentaries
          : customComplimentaries;
    pdfDoc.text('Complimentaries:', 32, 140);
    pdfDoc.text(complimentariesText, 32, 145, { maxWidth: 100 });
    pdfDoc.text(`${displaySymbol}${totalAmount.toLocaleString()}`, 162, 220);
  };

  const generatePDF = (overrideNum = null) => {
    return new Promise((resolve) => {
      const pdfDoc = new jsPDF();
      const img = new Image();
      let template = '/invoice_templateA.png';
      if (experienceType === 'Soothing') {
        template = '/invoice_templateB.png';
      } else if (experienceType === 'Positive' && currency === 'UGX') {
        template = '/invoice_templateC.png';
      }
      img.src = template;
      const displaySymbol =
        experienceType === 'Positive' &&
        serviceType === 'Gym' &&
        currency === 'USD'
          ? '$'
          : currency === 'UGX'
            ? 'UGX '
            : '$';

      img.onload = async () => {
        pdfDoc.addImage(img, 'PNG', 0, 0, 210, 297);
        await renderInvoiceContent(pdfDoc, displaySymbol, overrideNum);
        const pdfData = pdfDoc.output('datauristring');
        setPdfPreview(pdfData);
        resolve(pdfData);
      };
      img.onerror = async () => {
        await renderInvoiceContent(pdfDoc, displaySymbol, overrideNum);
        const pdfData = pdfDoc.output('datauristring');
        setPdfPreview(pdfData);
        resolve(pdfData);
      };
    });
  };

  useEffect(() => {
    if (step === 4) {
      generatePDF();
    }
  }, [
    step,
    clientName,
    company,
    phone,
    experienceType,
    serviceType,
    membership,
    customItem,
    customAmount,
    customComplimentaries,
    currency,
    qty,
  ]);

  const downloadPDF = async () => {
    if (pdfPreview) {
      const currentInvoiceNumber = await getInvoiceNumber(true);
      setInvoiceNumber(currentInvoiceNumber);
      const pdfData = await generatePDF(currentInvoiceNumber);
      const invoiceData = {
        invoiceNumber: currentInvoiceNumber,
        invoiceDate,
        clientName,
        company,
        phone,
        experienceType,
        serviceType,
        membership,
        customItem,
        customAmount,
        customComplimentaries,
        currency,
        qty,
        totalAmount,
        createdAt: serverTimestamp(),
      };
      await saveInvoiceDetails(invoiceData);
      const a = document.createElement('a');
      a.href = pdfData;
      a.download = `invoice_${currentInvoiceNumber}.pdf`;
      a.click();
    }
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-6 md:p-8">
      {step === 1 && (
        <>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-4">
            Select Branch
          </h2>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full mb-4 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="Positive">Positive Emotions</option>
            <option value="Soothing">Soothing Spot</option>
          </select>
          {branch === 'Positive' && (
            <div className="mt-6">
              <h3 className="text-center font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Positive Options
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => {
                    setExperienceType('Positive');
                    setServiceType('Gym');
                    setCurrency('USD');
                    nextStep();
                  }}
                  className="flex-1 min-w-[140px] px-4 py-3 rounded-xl font-medium bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-200 border-2 border-pink-200 dark:border-pink-800 hover:bg-pink-200/50 dark:hover:bg-pink-800/30 transition-colors"
                >
                  GYM Invoice (USD)
                </button>
                <button
                  onClick={() => {
                    setExperienceType('Positive');
                    setServiceType('Gym');
                    setCurrency('UGX');
                    nextStep();
                  }}
                  className="flex-1 min-w-[140px] px-4 py-3 rounded-xl font-medium bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-200 border-2 border-pink-200 dark:border-pink-800 hover:bg-pink-200/50 dark:hover:bg-pink-800/30 transition-colors"
                >
                  GYM Invoice (UGX)
                </button>
                <button
                  onClick={() => {
                    setExperienceType('Positive');
                    setServiceType('Spa');
                    setCurrency('UGX');
                    nextStep();
                  }}
                  className="flex-1 min-w-[140px] px-4 py-3 rounded-xl font-medium bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-200 border-2 border-pink-200 dark:border-pink-800 hover:bg-pink-200/50 dark:hover:bg-pink-800/30 transition-colors"
                >
                  SPA Invoice (UGX)
                </button>
              </div>
            </div>
          )}
          {branch === 'Soothing' && (
            <div className="mt-6">
              <h3 className="text-center font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Soothing Options
              </h3>
              <button
                onClick={() => {
                  setExperienceType('Soothing');
                  setServiceType('Spa');
                  setCurrency('UGX');
                  nextStep();
                }}
                className="w-full max-w-xs mx-auto flex justify-center px-4 py-3 rounded-xl font-medium bg-purple-900 text-white hover:bg-purple-800 transition-colors"
              >
                SPA Invoice (UGX)
              </button>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-4">
            Client Details
          </h2>
          <input
            type="text"
            placeholder="Client Name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="text"
            placeholder="Company Name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="text"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full mb-4 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={nextStep}
              className="flex-1 py-3 rounded-xl font-semibold bg-purple-900 hover:bg-purple-800 text-white transition-colors"
            >
              Next
            </button>
            <button
              onClick={prevStep}
              className="flex-1 py-3 rounded-xl font-semibold bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-200 border border-pink-200 dark:border-pink-800 hover:bg-pink-200/50 transition-colors"
            >
              Back
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-4">
            Additional Invoice Details
          </h2>
          {experienceType === 'Positive' &&
            serviceType === 'Gym' &&
            currency === 'USD' && (
              <>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Membership Type:
                </label>
                <select
                  value={membership}
                  onChange={(e) => setMembership(e.target.value)}
                  className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Membership</option>
                  <option value="Annual Individual GYM Membership">
                    Annual Individual - $1300
                  </option>
                  <option value="Annual Family GYM Membership">
                    Annual Family - $1800
                  </option>
                  <option value="Half Year GYM Membership Subscription">
                    Half Year - $800
                  </option>
                </select>
              </>
            )}
          {experienceType === 'Positive' &&
            serviceType === 'Gym' &&
            currency === 'UGX' && (
              <>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Membership Type:
                </label>
                <select
                  value={membership}
                  onChange={(e) => setMembership(e.target.value)}
                  className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Membership</option>
                  <option value="Annual Individual GYM Membership">
                    Annual Individual
                  </option>
                  <option value="Annual Family GYM Membership">
                    Annual Family
                  </option>
                  <option value="Half Year GYM Membership Subscription">
                    Half Year
                  </option>
                </select>
                <input
                  type="number"
                  placeholder="Amount (UGX)"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <textarea
                  placeholder="Custom complimentaries (optional)"
                  value={customComplimentaries}
                  onChange={(e) => setCustomComplimentaries(e.target.value)}
                  className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
                />
              </>
            )}
          {experienceType === 'Positive' && serviceType === 'Spa' && (
            <>
              <input
                type="text"
                placeholder="Item Description"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="number"
                placeholder="Amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="USD">USD</option>
                <option value="UGX">UGX</option>
              </select>
              <textarea
                placeholder="Custom complimentaries (optional)"
                value={customComplimentaries}
                onChange={(e) => setCustomComplimentaries(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
              />
            </>
          )}
          {experienceType === 'Soothing' && (
            <>
              <input
                type="text"
                placeholder="Item Description"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="number"
                placeholder="Amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <textarea
                placeholder="Custom complimentaries (optional)"
                value={customComplimentaries}
                onChange={(e) => setCustomComplimentaries(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
              />
            </>
          )}
          <input
            type="number"
            placeholder="Quantity"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full mb-4 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={nextStep}
              className="flex-1 py-3 rounded-xl font-semibold bg-purple-900 hover:bg-purple-800 text-white transition-colors"
            >
              Next
            </button>
            <button
              onClick={prevStep}
              className="flex-1 py-3 rounded-xl font-semibold bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-200 border border-pink-200 dark:border-pink-800 hover:bg-pink-200/50 transition-colors"
            >
              Back
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-4">
            Review & Generate Invoice
          </h2>
          {pdfPreview ? (
            <>
              <div className="mt-4 mb-4">
                <h3 className="text-center font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  PDF Preview
                </h3>
                <iframe
                  src={pdfPreview}
                  className="w-full h-[420px] border border-slate-200 dark:border-slate-700 rounded-xl"
                  title="PDF Preview"
                />
              </div>
              <button
                onClick={downloadPDF}
                className="w-full py-3 rounded-xl font-semibold bg-purple-900 hover:bg-purple-800 text-white transition-colors mb-3"
              >
                Download PDF & Save Invoice
              </button>
            </>
          ) : (
            <p className="text-center text-slate-500 py-8">Generating preview...</p>
          )}
          <button
            onClick={prevStep}
            className="w-full py-3 rounded-xl font-semibold bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-200 border border-pink-200 dark:border-pink-800 hover:bg-pink-200/50 transition-colors"
          >
            Back
          </button>
        </>
      )}
    </div>
  );
}
