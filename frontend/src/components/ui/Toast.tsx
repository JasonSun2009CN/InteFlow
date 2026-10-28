import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { Button } from "./Button";
import { useT } from "../../lib/i18n";

type ToastVariant = "info" | "success" | "warning" | "danger";

interface Toast {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  show: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 10);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[800] flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const DOT_TONE: Record<ToastVariant, string> = {
  info: "bg-slate-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const t = useT();
  useEffect(() => {
    if (toast.duration === 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className="pointer-events-auto min-w-[280px] max-w-md animate-slide-in rounded-sm bg-slate-900 p-4 text-white"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[toast.variant]}`}
          aria-hidden="true"
        />
        <div className="flex-1">
          {toast.title && <p className="mb-1 font-semibold">{toast.title}</p>}
          <p className="text-sm leading-6 opacity-90">{toast.message}</p>
          {toast.action && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-white hover:bg-white/15"
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </Button>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="cursor-pointer text-white/70 transition-colors hover:text-white"
          aria-label={t("Dismiss")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
