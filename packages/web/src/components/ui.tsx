import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="px-5 py-4 border-b border-[var(--color-border)]">{children}</div>;
}

export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 cursor-pointer";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]",
    secondary: "bg-[var(--color-bg-tertiary)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
    danger: "bg-[var(--color-error)] text-white hover:bg-red-600",
    ghost: "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-sm placeholder:text-[var(--color-text-secondary)]/50 focus:outline-none focus:border-[var(--color-primary)] ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-sm placeholder:text-[var(--color-text-secondary)]/50 focus:outline-none focus:border-[var(--color-primary)] min-h-[80px] ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={`w-full px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
}) {
  const variants = {
    default: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]",
    success: "bg-green-500/15 text-green-400",
    warning: "bg-yellow-500/15 text-yellow-400",
    error: "bg-red-500/15 text-red-400",
    info: "bg-blue-500/15 text-blue-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
    active: "success",
    completed: "success",
    in_progress: "info",
    assigned: "info",
    review: "warning",
    blocked: "error",
    rejected: "error",
    cancelled: "default",
    created: "default",
    paused: "warning",
    disabled: "default",
    error: "error",
  };
  return <Badge variant={map[status] || "default"}>{status}</Badge>;
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-[var(--color-text-secondary)]">
      {message}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer">
            &times;
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{children}</label>;
}

export function FormGroup({ children }: { children: ReactNode }) {
  return <div className="mb-4">{children}</div>;
}
