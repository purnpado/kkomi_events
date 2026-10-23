import React, { useState, useEffect } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { on } from '../core/eventBus';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function ToastProvider() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // 'toast.show' 이벤트를 구독하여 앱 어디서든 알림창 호출 가능
    const unsubscribe = on('toast.show', (event) => {
      const { title, message, type = 'info', duration = 3000 } = event.payload || {};
      const id = Date.now() + Math.random().toString(36).substring(2, 6);
      setToasts((prev) => [...prev, { id, title, message, type, duration }]);
    });
    return unsubscribe;
  }, []);

  const handleOpenChange = (id, open) => {
    if (!open) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} className="toast-icon-success" />;
      case 'error':
        return <AlertCircle size={18} className="toast-icon-error" />;
      default:
        return <Info size={18} className="toast-icon-info" />;
    }
  };

  return (
    <RadixToast.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <RadixToast.Root
          key={toast.id}
          className={`toast-root toast-${toast.type}`}
          duration={toast.duration}
          onOpenChange={(open) => handleOpenChange(toast.id, open)}
        >
          <div className="toast-content-wrapper">
            {getIcon(toast.type)}
            <div className="toast-text-group">
              {toast.title && <RadixToast.Title className="toast-title">{toast.title}</RadixToast.Title>}
              {toast.message && <RadixToast.Description className="toast-desc">{toast.message}</RadixToast.Description>}
            </div>
          </div>
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className="toast-viewport" />
    </RadixToast.Provider>
  );
}
