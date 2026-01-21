'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const toast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const showConfirm = useCallback(({ title = 'Confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) => {
    return new Promise((resolve) => {
      setConfirmState({
        title,
        message,
        confirmLabel,
        cancelLabel,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState?.resolve) confirmState.resolve(true);
    setConfirmState(null);
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState?.resolve) confirmState.resolve(false);
    setConfirmState(null);
  }, [confirmState]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ toast, showConfirm }}>
      {children}

      {/* Toasts - fixed top-right */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          {toasts.map((t) => (
            <div
              key={t.id}
              onClick={() => dismissToast(t.id)}
              className={`min-w-[280px] max-w-[360px] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-3 ${
                t.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : t.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              {t.type === 'error' && (
                <svg className="w-5 h-5 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              {t.type === 'success' && (
                <svg className="w-5 h-5 flex-shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              <span className="flex-1">{t.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={handleCancel}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{confirmState.title}</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{confirmState.message}</p>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
