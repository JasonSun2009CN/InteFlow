import { ReactNode } from "react";

interface Props {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles = {
  info: "bg-slate-100 text-slate-800",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

/** A quiet notice: a change of ground, no border or shadow. */
export function Banner({
  variant = "info",
  title,
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`flex gap-3 rounded-sm p-4 ${variantStyles[variant]} ${className}`}
      role="alert"
    >
      <div className="flex-1">
        {title && <h4 className="mb-1 font-semibold">{title}</h4>}
        <div className="text-sm leading-6">{children}</div>
      </div>
    </div>
  );
}
