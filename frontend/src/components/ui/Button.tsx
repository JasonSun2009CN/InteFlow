import { ButtonHTMLAttributes, forwardRef } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

type Variant = NonNullable<Props["variant"]>;
type Size = NonNullable<Props["size"]>;

/**
 * Flat, decisive actions. Primary is solid ink; the accent is reserved for
 * selection, focus and small state marks rather than large button fills.
 */
const BASE =
  "btn inline-flex cursor-pointer items-center justify-center rounded-sm border border-transparent font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#171715)]";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "btn-primary bg-slate-900 text-white hover:bg-slate-700 active:bg-slate-800",
  secondary: "btn-secondary bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300",
  ghost: "btn-ghost text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "btn-danger bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "gap-1.5 px-3 py-1.5 text-sm",
  md: "gap-2 px-4 py-2 text-sm",
  lg: "gap-2 px-5 py-3 text-base",
};

/**
 * Button classes without the button element — for actions that have to be a
 * link (`<Link className={buttonClasses(...)}>`), so themes that restyle
 * `.btn-primary` reach the home screen's calls to action too.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  return `${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      disabled,
      children,
      className = "",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonClasses({ variant, size, className })}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {icon && iconPosition === "left" && !loading && <span aria-hidden="true">{icon}</span>}
        <span>{children}</span>
        {icon && iconPosition === "right" && !loading && <span aria-hidden="true">{icon}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";
