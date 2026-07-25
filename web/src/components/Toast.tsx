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
  durationMs: number;
  leaving?: boolean;
};

type ToastContextValue = {
  toast: (message: string, toneOrOptions?: ToastTone | ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 5200;
const EXIT_MS = 320;
const KOFI_URL = "https://ko-fi.com/igottic";

/** Per-tool first-success Ko-fi nudge keys. */
export type KofiToastTool =
  | "commander-deck"
  | "pimp"
  | "sleeves"
  | "dice"
  | "boosters"
  | "pod"
  | "proxy"
  | "bulk"
  | "pack-wars";

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

  const remove = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const existing = timers.current.get(id);
      if (existing) window.clearTimeout(existing);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      const handle = window.setTimeout(() => remove(id), EXIT_MS);
      timers.current.set(id, handle);
    },
    [remove],
  );

  const toast = useCallback(
    (message: string, toneOrOptions?: ToastTone | ToastOptions) => {
      const { tone, durationMs, action } = resolveOptions(toneOrOptions);
      seq.current += 1;
      const id = `${prefix}-${seq.current}`;
      setItems((prev) => [...prev.slice(-3), { id, message, tone, action, durationMs }]);
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
                className={`toast toast--${item.tone}${item.leaving ? " toast--leaving" : ""}`}
                role={item.tone === "error" ? "alert" : "status"}
                style={{ ["--toast-duration" as string]: `${item.durationMs}ms` }}
              >
                <div className="toast__body">
                  <span className="toast__msg">{item.message}</span>
                  {item.action && (
                    <a
                      className="toast__action"
                      href={item.action.href}
                      target="_blank"
                      rel="noopener noreferrer"
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
                <div className="toast__progress" aria-hidden>
                  <div className="toast__progress-bar" />
                </div>
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

/**
 * One-time Ko-fi nudge after a successful generation for a given tool.
 * Safe to call often — shows at most once per tool (localStorage).
 */
export function maybeShowKofiSupportToast(
  toast: ToastContextValue["toast"],
  tool: KofiToastTool,
): void {
  const key = `magicgen-kofi-toast-${tool}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    return;
  }
  window.setTimeout(() => {
    toast("Enjoying MagicGen? A Ko-fi tip keeps the tools growing.", {
      tone: "info",
      durationMs: 12000,
      action: { label: "Support on Ko-fi", href: KOFI_URL },
    });
  }, 700);
}
