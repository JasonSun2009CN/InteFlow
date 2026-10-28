import { HTMLAttributes, forwardRef } from "react";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
}

const variants = {
  default: "bg-slate-100 text-slate-600",
  primary: "bg-primary-50 text-primary-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  outline: "border border-slate-300 text-slate-600",
};
const sizes = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-0.5 text-sm",
};

/** A flat label, not a pill: colour only when it carries state. */
export const Badge = forwardRef<HTMLSpanElement, Props>(
  ({ variant = "default", size = "md", dot, children, className = "", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          badge badge-${variant} inline-flex items-center gap-1.5 rounded-sm font-medium
          ${variants[variant]} ${sizes[size]} ${className}
        `}
        {...props}
      >
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";
