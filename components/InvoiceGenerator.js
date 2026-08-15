'use client';

import { useMemo, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getMembershipTypes } from '@/lib/memberships';
import { searchClients } from '@/lib/clients';
import { getPartnerCompanies } from '@/lib/partnerCompanies';

export default function InvoiceGenerator() {
  const [step, setStep] = useState(1);
  const [branch, setBranch] = useState('Positive');
  const [clientName, setClientName] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [company, setCompany] = useState('');
  const [partnerCompanies, setPartnerCompanies] = useState([]);
  const [partnerCompaniesLoading, setPartnerCompaniesLoading] = useState(true);
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
  const [gymMembershipTypes, setGymMembershipTypes] = useState([]);
  const [spaMembershipTypes, setSpaMembershipTypes] = useState([]);
  const [membershipTypesLoading, setMembershipTypesLoading] = useState(true);

  const membershipOptions = useMemo(() => {
    const availableTypes = serviceType === 'Spa' ? spaMembershipTypes : gymMembershipTypes;
    return availableTypes.filter(
      (type) => !type.currency || type.currency === currency
    );
  }, [currency, gymMembershipTypes, serviceType, spaMembershipTypes]);

  const formatEntitlements = (entitlements) => {
    if (!Array.isArray(entitlements) || entitlements.length === 0) return '';

    return entitlements
      .map((entitlement) => {
        const quantity = Number(entitlement.quantity || 1);
        return `${entitlement.name}${quantity > 1 ? ` x${quantity}` : ''}`;
      })
      .join(', ');
  };

  const selectedMembershipType = useMemo(
    () => membershipOptions.find((type) => type.id === membership) || null,
    [membership, membershipOptions]
  );

  useEffect(() => {
    let isMounted = true;

    const loadMembershipTypes = async () => {
      setMembershipTypesLoading(true);
      const [gymTypes, spaTypes] = await Promise.all([
        getMembershipTypes(false),
        getMembershipTypes(true),
      ]);

      if (isMounted) {
        setGymMembershipTypes(gymTypes);
        setSpaMembershipTypes(spaTypes);
        setMembershipTypesLoading(false);
      }
    };

    loadMembershipTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMembershipChange = (membershipId) => {
    setMembership(membershipId);
    const nextMembershipType = membershipOptions.find(
      (type) => type.id === membershipId
    );

    if (nextMembershipType) {
      setCustomAmount(String(nextMembershipType.price || ''));
      setCustomItem(nextMembershipType.type || '');
      setCustomComplimentaries(
        nextMembershipType.description ||
          formatEntitlements(nextMembershipType.entitlements)
      );
    }
  };

  const defaultGymComplimentaries =
    'Complimentary health drinks, tea and snacks, swimming, steam bath and sauna.';
  const defaultSpaComplimentaries =
    'Health drinks and Tea, Juices, Fruit Salad and many more';

  const computedCustomAmount = parseFloat(customAmount) || 0;
  const usesManualMembershipAmount = Boolean(selectedMembershipType?.isReducingBalance);
  const unitAmount = usesManualMembershipAmount
    ? computedCustomAmount
    : selectedMembershipType
      ? Number(selectedMembershipType.price || 0)
      : computedCustomAmount || 0;

  const totalAmount = unitAmount * (Number(qty) || 0);

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
      selectedMembershipType?.type || customItem;
    pdfDoc.text(itemDescription, 32, 110);
    pdfDoc.text(`${displaySymbol}${unitAmount.toLocaleString()}`, 125, 110);
    pdfDoc.text(`${displaySymbol}${totalAmount.toLocaleString()}`, 162, 110);
    const complimentariesText =
      customComplimentaries ||
      (serviceType === 'Spa'
        ? defaultSpaComplimentaries
        : defaultGymComplimentaries);
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
        const previewUrl = pdfDoc.output('bloburl');
        setPdfPreview(previewUrl);
        resolve(pdfData);
      };
      img.onerror = async () => {
        await renderInvoiceContent(pdfDoc, displaySymbol, overrideNum);
        const pdfData = pdfDoc.output('datauristring');
        const previewUrl = pdfDoc.output('bloburl');
        setPdfPreview(previewUrl);
        resolve(pdfData);
      };
    });
  };

  useEffect(() => {
    let isMounted = true;
    getPartnerCompanies().then((companies) => {
      if (isMounted) setPartnerCompanies(companies);
      if (isMounted) setPartnerCompaniesLoading(false);
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const queryText = clientName.trim();
    if (step !== 2 || queryText.length < 2 || selectedClientId) {
      setClientSuggestions([]);
      setIsSearchingClients(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setIsSearchingClients(true);
      const results = await searchClients(queryText);
      setClientSuggestions(results.slice(0, 6));
      setIsSearchingClients(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [clientName, selectedClientId, step]);

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
        membershipName: selectedMembershipType?.type || '',
        isReducingBalance: Boolean(selectedMembershipType?.isReducingBalance),
        customItem,
        customAmount: String(unitAmount),
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
                    setMembership('');
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
                    setMembership('');
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
                    setMembership('');
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
                  setMembership('');
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
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Client name or phone number"
              value={clientName}
              onChange={(e) => { setClientName(e.target.value); setSelectedClientId(''); }}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              autoComplete="off"
            />
            {(isSearchingClients || clientSuggestions.length > 0) && !selectedClientId && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {isSearchingClients && <div className="px-4 py-3 text-xs text-slate-500">Searching clients...</div>}
                {!isSearchingClients && clientSuggestions.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => { setSelectedClientId(client.id); setClientName(client.name || ''); setPhone(client.phoneNumber || ''); }}
                    className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <span className="block text-sm font-semibold text-slate-800 dark:text-white">{client.name}</span>
                    <span className="block text-xs text-slate-500">{client.phoneNumber || 'No phone number'}</span>
                  </button>
                ))}
                {!isSearchingClients && clientSuggestions.length === 0 && <div className="px-4 py-3 text-xs text-slate-500">No matching client found. You can continue manually.</div>}
              </div>
            )}
          </div>
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={partnerCompaniesLoading}
            className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Self-pay / no company</option>
            {partnerCompanies.map((partnerCompany) => <option key={partnerCompany.id} value={partnerCompany.name}>{partnerCompany.name}</option>)}
          </select>
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
          {experienceType === 'Positive' && serviceType === 'Gym' && (
            <>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Membership Type:
              </label>
              <select
                value={selectedMembershipType ? membership : ''}
                onChange={(e) => handleMembershipChange(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={membershipTypesLoading}
              >
                <option value="">
                  {membershipTypesLoading ? 'Loading memberships...' : 'Select Membership'}
                </option>
                {membershipOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.type} - {type.isReducingBalance
                      ? 'Manual reducing balance'
                      : `${(type.currency || currency) === 'UGX' ? 'UGX ' : '$'}${Number(type.price || 0).toLocaleString()}`}
                  </option>
                ))}
              </select>
              {!membershipTypesLoading && membershipOptions.length === 0 && (
                <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
                  No {currency} gym memberships found. Add one in Membership Management or enter a custom item below.
                </p>
              )}
              <input
                type="text"
                placeholder="Custom item description"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="number"
                placeholder={`Amount (${currency})`}
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
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Spa Membership Type (optional):
              </label>
              <select
                value={selectedMembershipType ? membership : ''}
                onChange={(e) => handleMembershipChange(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={membershipTypesLoading}
              >
                <option value="">
                  {membershipTypesLoading ? 'Loading memberships...' : 'Select Spa Membership'}
                </option>
                {membershipOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.type} - {type.isReducingBalance
                      ? 'Manual reducing balance'
                      : `${(type.currency || currency) === 'UGX' ? 'UGX ' : '$'}${Number(type.price || 0).toLocaleString()}`}
                  </option>
                ))}
              </select>
              {!membershipTypesLoading && membershipOptions.length === 0 && (
                <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
                  No {currency} spa memberships found. Add one in Spa Membership Management or enter a custom item below.
                </p>
              )}
              <input
                type="text"
                placeholder="Item Description"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="number"
                placeholder={usesManualMembershipAmount ? `Reducing balance amount (${currency})` : "Amount"}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setMembership('');
                }}
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
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Spa Membership Type (optional):
              </label>
              <select
                value={selectedMembershipType ? membership : ''}
                onChange={(e) => handleMembershipChange(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={membershipTypesLoading}
              >
                <option value="">
                  {membershipTypesLoading ? 'Loading memberships...' : 'Select Spa Membership'}
                </option>
                {membershipOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.type} - {type.isReducingBalance
                      ? 'Manual reducing balance'
                      : `${(type.currency || currency) === 'UGX' ? 'UGX ' : '$'}${Number(type.price || 0).toLocaleString()}`}
                  </option>
                ))}
              </select>
              {!membershipTypesLoading && membershipOptions.length === 0 && (
                <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
                  No {currency} spa memberships found. Add one in Spa Membership Management or enter a custom item below.
                </p>
              )}
              <input
                type="text"
                placeholder="Item Description"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                className="w-full mb-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="number"
                placeholder={usesManualMembershipAmount ? `Reducing balance amount (${currency})` : "Amount"}
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
                  className="hidden sm:block w-full h-[420px] border border-slate-200 dark:border-slate-700 rounded-xl"
                  title="PDF Preview"
                />
                <div className="sm:hidden rounded-xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-sm text-slate-600 dark:text-slate-300">Mobile browsers may not embed PDF previews directly.</p>
                  <a
                    href={pdfPreview}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-purple-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-800"
                  >
                    Open PDF Preview
                  </a>
                </div>
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
