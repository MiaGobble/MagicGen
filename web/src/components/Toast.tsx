import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ToastTone = "info" | "success" | "error";

export type ToastAction = {
  label: string;
  href: string;
};

export type ToastOptions = {
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
};

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

type ToastContextValue = {
  toast: (message: string, toneOrOptions?: ToastTone | ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 3000;
const KOFI_TOAST_KEY = "magicgen-kofi-toast-shown";
const KOFI_URL = "https://ko-fi.com/igottic";

function resolveOptions(toneOrOptions?: ToastTone | ToastOptions): Required<
  Pick<ToastOptions, "tone" | "durationMs">
> &
  Pick<ToastOptions, "action"> {
  if (!toneOrOptions || typeof toneOrOptions === "string") {
    return { tone: toneOrOptions ?? "info", durationMs: DISMISS_MS };
  }
  return {
    tone: toneOrOptions.tone ?? "info",
    durationMs: toneOrOptions.durationMs ?? DISMISS_MS,
    action: toneOrOptions.action,
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const prefix = useId();
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, toneOrOptions?: ToastTone | ToastOptions) => {
      const { tone, durationMs, action } = resolveOptions(toneOrOptions);
      seq.current += 1;
      const id = `${prefix}-${seq.current}`;
      setItems((prev) => [...prev.slice(-4), { id, message, tone, action }]);
      const handle = window.setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, handle);
    },
    [dismiss, prefix],
  );

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) window.clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="toast-stack" aria-live="polite" aria-relevant="additions">
            {items.map((item) => (
              <div
                key={item.id}
                className={`toast toast--${item.tone}`}
                role={item.tone === "error" ? "alert" : "status"}
              >
                <div className="toast__body">
                  <span className="toast__msg">{item.message}</span>
                  {item.action && (
                    <a
                      className="toast__action"
                      href={item.action.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.action.label}
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  className="toast__close"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(item.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** One-time Ko-fi nudge after a successful generation. Safe to call often. */
export function maybeShowKofiSupportToast(
  toast: ToastContextValue["toast"],
): void {
  try {
    if (localStorage.getItem(KOFI_TOAST_KEY)) return;
    localStorage.setItem(KOFI_TOAST_KEY, "1");
  } catch {
    return;
  }
  toast("Enjoying MagicGen? A Ko-fi tip keeps the tools running.", {
    tone: "info",
    durationMs: 10000,
    action: { label: "Support on Ko-fi", href: KOFI_URL },
  });
}
