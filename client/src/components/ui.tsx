import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Moon, Search, Sun, Upload, X } from "lucide-react";
import { api } from "../lib/api";

export const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white ring-1 ring-inset ring-white/15 shadow-[0_10px_24px_-12px_rgba(91,71,224,0.85)] hover:brightness-[1.06] active:translate-y-px",
  secondary:
    "bg-surface text-ink ring-1 ring-inset ring-ink/[0.09] shadow-[0_1px_2px_rgba(20,25,40,0.04)] hover:text-primary hover:ring-primary/30",
  ghost: "bg-transparent text-ink-soft hover:bg-ink/[0.06] hover:text-ink",
  danger:
    "bg-ink text-white ring-1 ring-inset ring-white/10 shadow-[0_10px_24px_-12px_rgba(20,25,40,0.9)] hover:bg-ink/90",
  success:
    "bg-ocean text-white ring-1 ring-inset ring-white/15 shadow-[0_10px_24px_-12px_rgba(78,101,246,0.85)] hover:brightness-[1.06]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-xl",
  md: "h-10 px-5 text-[13.5px] gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-2xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  full,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        buttonStyles[variant],
        buttonSizes[size],
        full && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */

export type Tone = "purple" | "blue" | "green" | "amber" | "coral" | "gray" | "red" | "pink";

const tones: Record<Tone, string> = {
  purple: "bg-primary/10 text-primary",
  blue: "bg-primary-light text-[#141928]",
  green: "bg-lime text-[#141928]",
  amber: "bg-canvas text-ink-soft dark:bg-white/[0.06] dark:text-ink-soft",
  coral: "bg-primary-light/70 text-ocean",
  gray: "bg-canvas text-ink-soft dark:bg-white/[0.06] dark:text-ink-soft",
  red: "bg-ink text-canvas dark:bg-white/[0.09] dark:text-ink dark:ring-1 dark:ring-inset dark:ring-white/10",
  pink: "bg-primary-light/70 text-ocean",
};

export function Badge({ children, tone = "gray", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("chip", tones[tone], className)}>{children}</span>;
}

const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "green",
  VERIFIED: "green",
  PAID: "green",
  RESOLVED: "green",
  PENDING: "amber",
  INVITED: "amber",
  NOTICE: "amber",
  SUBMITTED: "amber",
  PARTIAL: "amber",
  ACKNOWLEDGED: "blue",
  IN_PROGRESS: "blue",
  OCCUPIED: "coral",
  UNPAID: "coral",
  OVERDUE: "red",
  SUSPENDED: "red",
  REJECTED: "red",
  VACATED: "gray",
  CLOSED: "gray",
  MAINTENANCE: "red",
  SELECTED: "blue",
  ALL: "purple",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  VERIFIED: "Verified",
  PAID: "Paid",
  RESOLVED: "Resolved",
  PENDING: "Pending",
  INVITED: "Invited",
  NOTICE: "Notice period",
  SUBMITTED: "Submitted",
  PARTIAL: "Partially paid",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  UNPAID: "Unpaid",
  OVERDUE: "Overdue",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
  VACATED: "Vacated",
  CLOSED: "Closed",
  MAINTENANCE: "Maintenance",
  SELECTED: "Selected",
  ALL: "Everyone",
  SUPER_ADMIN: "Administrator",
  PG_OWNER: "PG owner",
  RESIDENT: "Resident",
};

export const statusLabel = (status: string) =>
  STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "gray"}>{statusLabel(status)}</Badge>;
}

/* ------------------------------------------------------------------ Fields */

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
  className,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="error-text">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={cn("field", error && "field-error", className)} {...props} />;
}

export function Textarea({
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className={cn("field min-h-[96px] resize-y", error && "field-error", className)} {...props} />;
}

export function Select({
  error,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <div className="relative">
      <select className={cn("field appearance-none pr-9", error && "field-error", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <input
        className="field pl-10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close dialog"
        tabIndex={-1}
      />
      <div
        className={cn(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 ring-1 ring-ink/10 animate-slide-in sm:rounded-3xl sm:p-6",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl"
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[13px] text-ink-muted">{description}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-muted transition hover:bg-ink/5" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: ButtonVariant;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-soft">{description}</p>
    </Modal>
  );
}

/* -------------------------------------------------------------- Empty/Load */

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-center ring-1 ring-inset ring-ink/[0.07]",
        compact ? "px-4 py-8" : "px-6 py-12"
      )}
    >
      <div className="pointer-events-none absolute -top-10 h-24 w-40 rounded-full bg-primary/10 blur-2xl" aria-hidden />
      {icon ? <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-canvas">{icon}</div> : null}
      <p className="text-sm font-bold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface space-y-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink/10 bg-ink/[0.04] p-4 text-sm text-ink">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry ? (
          <button onClick={onRetry} className="mt-2 font-semibold underline underline-offset-2">
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Stats */

const accents: Record<Tone, string> = {
  purple: "bg-primary",
  blue: "bg-ocean",
  green: "bg-lime",
  amber: "bg-primary-light",
  coral: "bg-primary-light",
  gray: "bg-ink/20",
  red: "bg-ink",
  pink: "bg-primary-light",
};

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "purple",
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <div className="surface group relative flex flex-col gap-3 overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-5">
      <span className={cn("absolute left-5 top-0 h-[3px] w-10 rounded-b-full opacity-80 transition group-hover:w-16 group-hover:opacity-100", accents[tone])} aria-hidden />
      <span
        className={cn("pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition group-hover:opacity-[0.12]", accents[tone])}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <p className="min-h-[2.05rem] text-[11.5px] font-semibold uppercase leading-[1.4] tracking-[0.06em] text-ink-muted">{label}</p>
        {icon ? (
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-black/[0.05]", tones[tone])}>{icon}</span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[29px] font-extrabold leading-none tracking-[-0.03em] text-ink">{value}</p>
        {trend ? (
          <span className={cn("text-xs font-semibold", trend.positive ? "text-success" : "text-ink-muted")}>{trend.value}</span>
        ) : null}
      </div>
      {hint ? <p className="text-[11.5px] leading-snug text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Progress({ value, tone = "primary" }: { value: number; tone?: "primary" | "green" | "amber" | "coral" }) {
  const colors = {
    primary: "bg-gradient-to-r from-primary to-ocean",
    green: "bg-gradient-to-r from-lime to-primary-light",
    amber: "bg-gradient-to-r from-primary-light to-white",
    coral: "bg-gradient-to-r from-ocean to-primary-light",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full shadow-[0_1px_4px_rgba(20,25,40,0.12)] transition-all", colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const label = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return src ? (
    <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white ring-2 ring-white shadow-[0_2px_8px_rgba(20,25,40,0.14)]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {label}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto rounded-xl bg-ink/[0.05] p-1 ring-1 ring-inset ring-ink/[0.04]" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold transition",
            value === tab.value
              ? "bg-surface font-bold text-primary shadow-[0_1px_2px_rgba(20,25,40,0.08)] ring-1 ring-inset ring-primary/25"
              : "text-ink-muted hover:bg-surface/60 hover:text-ink"
          )}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="ml-1.5 text-xs text-ink-muted">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink/5 py-2.5 last:border-0">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold text-ink">{value || "—"}</span>
    </div>
  );
}

/* -------------------------------------------------------------- Theme switch */

export function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pg-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const active = stored === "dark" || (!stored && prefersDark);
    setDark(active);
    document.documentElement.classList.toggle("dark", active);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pg-theme", next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl bg-surface px-2 py-1.5 ring-1 ring-inset ring-ink/[0.08] transition hover:ring-primary/30",
        className
      )}
    >
      <span
        className={cn(
          "relative flex h-6 w-11 shrink-0 items-center rounded-full p-[3px] transition-colors",
          dark ? "bg-primary" : "bg-ink/15"
        )}
      >
        <span
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-[9px] shadow-sm transition-transform",
            dark ? "translate-x-5" : "translate-x-0"
          )}
          aria-hidden
        >
          {dark ? <Moon className="h-2.5 w-2.5 text-primary" /> : <Sun className="h-2.5 w-2.5 text-ink-muted" />}
        </span>
      </span>
      {withLabel ? (
        <span className="pr-1 text-[12.5px] font-semibold text-ink-soft">{dark ? "Dark" : "Light"}</span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ Toasts */

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lift animate-pop-in",
              toast.tone === "success" && "bg-primary text-white",
              toast.tone === "error" && "bg-ink text-canvas",
              toast.tone === "info" && "bg-ocean text-white"
            )}
          >
            {toast.tone === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

/* ----------------------------------------------------------- Image uploader */

export function ImageUploader({
  images,
  onChange,
  folder,
  max = 4,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  folder: "pg" | "rooms" | "complaints" | "avatars" | "menu";
  max?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      const next = [...images];
      for (const file of Array.from(files).slice(0, max - images.length)) {
        if (file.size > 5 * 1024 * 1024) {
          setError("Images must be smaller than 5 MB.");
          continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read that file."));
          reader.readAsDataURL(file);
        });
        const result = await api.upload(dataUrl, folder);
        next.push(result.url);
      }
      onChange(next);
      toast.push("Image uploaded.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((image) => (
          <div key={image} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-ink/10">
            <img src={image} alt="Uploaded" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((item) => item !== image))}
              className="absolute right-1 top-1 rounded-full bg-ink/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {images.length < max ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink/20 text-[11px] font-semibold text-ink-muted transition hover:border-primary/50 hover:text-primary"
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading" : "Add photo"}
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
