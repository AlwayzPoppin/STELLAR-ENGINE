import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, Toast } from '../store/useToastStore';

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger entrance animation next tick
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleDismiss = () => {
    setMounted(false);
    // Wait for slide-out transition
    setTimeout(() => {
      removeToast(toast.id);
    }, 200);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertOctagon size={16} className="text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info size={16} className="text-sky-400 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-l-4 border-l-emerald-500 border-t border-r border-b border-neutral-800/80';
      case 'error':
        return 'border-l-4 border-l-rose-500 border-t border-r border-b border-neutral-800/80';
      case 'warning':
        return 'border-l-4 border-l-amber-500 border-t border-r border-b border-neutral-800/80';
      case 'info':
      default:
        return 'border-l-4 border-l-sky-500 border-t border-r border-b border-neutral-800/80';
    }
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-lg bg-neutral-950/85 backdrop-blur-md shadow-2xl transition-all duration-300 transform pointer-events-auto select-none ${getBorderColor()} ${
        mounted ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'
      }`}
      style={{
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
      }}
    >
      <div className="mt-0.5">{getIcon()}</div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-neutral-100 leading-tight">
          {toast.title}
        </h4>
        {toast.message && (
          <p className="mt-1 text-[11px] text-neutral-400 font-medium leading-normal break-words">
            {toast.message}
          </p>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="p-0.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/40 rounded transition-all cursor-pointer shrink-0"
        title="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
