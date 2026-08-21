'use client';

import { useEffect, useId, useState } from 'react';
import { getPartnerCompanies } from '@/lib/partnerCompanies';

export default function CompanySelect({ value = '', onChange }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCustom, setIsCustom] = useState(false);
  const listId = useId();

  useEffect(() => {
    let active = true;
    const loadCompanies = async () => {
      const savedCompanies = await getPartnerCompanies();
      if (!active) return;
      setCompanies(savedCompanies);
      setLoading(false);
    };
    loadCompanies();
    return () => {
      active = false;
    };
  }, []);

  const handleSelect = (event) => {
    const selectedValue = event.target.value;
    if (selectedValue === '__custom__') {
      setIsCustom(true);
      onChange('');
      return;
    }
    setIsCustom(false);
    onChange(selectedValue);
  };

  const selectedSavedValue = !isCustom && companies.some((company) => company.name === value) ? value : '';

  return (
    <div className="space-y-2">
      <select
        value={selectedSavedValue || (isCustom ? '__custom__' : '')}
        onChange={handleSelect}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
        aria-label="Select a saved company"
      >
        <option value="">{loading ? 'Loading saved companies...' : 'Select a saved company'}</option>
        {companies.map((company) => <option key={company.id} value={company.name}>{company.name}</option>)}
        <option value="__custom__">Enter a new company...</option>
      </select>
      {(isCustom || !companies.length) && (
        <input
          type="text"
          list={listId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
          placeholder={companies.length ? 'Type a new company name' : 'Enter company name'}
          aria-label="Company name"
        />
      )}
      <datalist id={listId}>{companies.map((company) => <option key={company.id} value={company.name} />)}</datalist>
    </div>
  );
}
