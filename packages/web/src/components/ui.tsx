import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

export function Card({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`
        bg-[var(--color-surface)] border border-white/10 rounded-2xl
        ${hover ? "transition-all duration-300 hover:-translate-y-0.5 hover:border-[#F7931A]/40 hover:shadow-[0_0_30px_-10px_rgba(247,147,26,0.15)]" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 py-5 border-b border-white/10 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-full";
  const sizes = {
    sm: "px-4 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3 text-base",
  };
  const variants = {
    primary:
      "bg-gradient-to-r from-[#EA580C] to-[#F7931A] text-white font-semibold tracking-wide shadow-[0_0_20px_-5px_rgba(234,88,12,0.5)] hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(247,147,26,0.6)]",
    secondary:
      "bg-white/5 text-[var(--color-foreground)] border border-white/10 hover:bg-white/10 hover:border-white/20",
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40",
    ghost:
      "text-[var(--color-muted)] hover:text-[#F7931A] hover:bg-white/5",
    outline:
      "border-2 border-white/20 text-white hover:border-white hover:bg-white/10",
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
      className={`
        w-full h-12 px-4 py-2 rounded-lg
        bg-black/50 border-b-2 border-white/20
        text-white text-sm font-body
        placeholder:text-white/30
        focus-visible:outline-none focus-visible:border-[#F7931A]
        focus-visible:shadow-[0_10px_20px_-10px_rgba(247,147,26,0.3)]
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-200
        ${className}
      `}
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
      className={`
        w-full px-4 py-3 rounded-lg
        bg-black/50 border-b-2 border-white/20
        text-white text-sm font-body
        placeholder:text-white/30
        focus-visible:outline-none focus-visible:border-[#F7931A]
        focus-visible:shadow-[0_10px_20px_-10px_rgba(247,147,26,0.3)]
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-200 min-h-[80px] resize-y
        ${className}
      `}
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
      className={`
        w-full h-12 px-4 py-2 rounded-lg appearance-none
        bg-black/50 border-b-2 border-white/20
        text-white text-sm font-body
        focus-visible:outline-none focus-visible:border-[#F7931A]
        focus-visible:shadow-[0_10px_20px_-10px_rgba(247,147,26,0.3)]
        transition-all duration-200
        bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')]
        bg-no-repeat bg-[right_12px_center] bg-[length:16px]
        ${className}
      `}
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
  variant?: "default" | "success" | "warning" | "error" | "info" | "orange";
}) {
  const variants = {
    default: "bg-white/5 text-[var(--color-muted)] border-white/10",
    success: "bg-green-500/10 text-green-400 border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    orange: "bg-[#F7931A]/10 text-[#F7931A] border-[#F7931A]/20",
  };
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
        font-mono font-medium tracking-wide border
        ${variants[variant]}
      `}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "success" | "warning" | "error" | "info" | "default" | "orange"> = {
    active: "success",
    completed: "success",
    in_progress: "orange",
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
    <div className="flex items-center justify-between mb-8">
      <h2 className="text-3xl font-heading font-bold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="text-center py-16">
      {icon && <div className="mb-4 flex justify-center text-[var(--color-muted)]/50">{icon}</div>}
      <p className="text-[var(--color-muted)] text-sm">{message}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="
          relative bg-[var(--color-surface)] border border-white/10 rounded-2xl
          w-full max-w-lg max-h-[90vh] overflow-y-auto
          shadow-[0_0_60px_-15px_rgba(247,147,26,0.15)]
        "
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <h3 className="text-lg font-heading font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="
              w-8 h-8 rounded-full flex items-center justify-center
              text-[var(--color-muted)] hover:text-white
              hover:bg-white/10 transition-colors cursor-pointer
            "
          >
            &times;
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-mono font-medium text-[var(--color-muted)] mb-2 tracking-wider uppercase">
      {children}
    </label>
  );
}

export function FormGroup({ children }: { children: ReactNode }) {
  return <div className="mb-5">{children}</div>;
}

export function Divider() {
  return <div className="border-t border-white/5 my-6" />;
}

export function GlowDot({ color = "orange" }: { color?: "orange" | "green" | "red" | "yellow" }) {
  const colors = {
    orange: "bg-[#F7931A]",
    green: "bg-green-400",
    red: "bg-red-400",
    yellow: "bg-yellow-400",
  };
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[color]} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${colors[color]}`} />
    </span>
  );
}
