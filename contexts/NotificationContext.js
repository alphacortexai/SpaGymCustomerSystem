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

  const showConfirm = useCallback(({ title = 'Confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default' }) => {
    return new Promise((resolve) => {
      setConfirmState({
        title,
        message,
        confirmLabel,
        cancelLabel,
        tone,
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

      <div className="apple-toast-stack pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`apple-toast apple-toast-${t.type === 'error' ? 'error' : t.type === 'success' ? 'success' : 'info'}`}
            >
              <span className="flex-1">{t.message}</span>
              <button type="button" onClick={() => dismissToast(t.id)} className="text-sm font-semibold text-[#0071e3]" aria-label="Dismiss notification">OK</button>
            </div>
          ))}
        </div>
      </div>

      {confirmState && (
        <div className="apple-sheet-backdrop fixed inset-0 z-[190] flex items-center justify-center p-4" onClick={handleCancel}>
          <div
            className="apple-sheet w-full max-w-sm rounded-[22px] p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title" className="mb-2 text-lg font-bold text-[#1d1d1f]">{confirmState.title}</h3>
            <p id="confirm-message" className="mb-6 text-sm leading-6 text-[#6e6e73]">{confirmState.message}</p>
            <div className="flex gap-3">
              <button type="button" onClick={handleCancel} className="apple-button-secondary flex-1" autoFocus>
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`flex-1 text-white ${confirmState.tone === 'destructive' || /delete|remove|revoke/i.test(confirmState.confirmLabel) ? 'apple-button-destructive' : 'apple-button-primary'}`}
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
