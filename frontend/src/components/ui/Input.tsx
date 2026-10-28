import { InputHTMLAttributes, forwardRef, ReactNode } from "react";

interface OwnProps {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

type Props = OwnProps & Omit<InputHTMLAttributes<HTMLInputElement>, "leadingIcon" | "trailingIcon">;

export const Input = forwardRef<HTMLInputElement, Props>(
  (
    {
      label,
      error,
      hint,
      leadingIcon,
      trailingIcon,
      className = "",
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-800">
            {label}
          </label>
        )}
        <div className="relative">
          {leadingIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              {leadingIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full rounded-sm border bg-transparent text-slate-900 placeholder:text-slate-400
              transition-colors duration-150
              focus:border-slate-900 focus:outline-none focus:ring-0
              disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500
              ${leadingIcon ? "pl-10" : "pl-3"}
              ${trailingIcon ? "pr-10" : "pr-3"}
              py-2.5 text-sm
              ${error ? "border-danger-500" : "border-slate-300 hover:border-slate-400"}
            `}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {trailingIcon && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
              {trailingIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-slate-500">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
