import { ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: Props) {
  return (
    <div className={`flex flex-col items-center px-4 py-16 text-center ${className}`}>
      {icon && <div className="mb-5 text-slate-300" aria-hidden="true">{icon}</div>}
      <h3 className="mb-2 text-xl font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mx-auto mb-7 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      )}
      {action && (
        <Button variant={action.variant || "primary"} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
