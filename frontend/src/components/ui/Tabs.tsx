import { useRef, useEffect } from "react";

interface Tab {
  key: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  variant?: "line" | "enclosed" | "soft";
  /** Accessible name for the tab list. */
  ariaLabel?: string;
}

export function Tabs({
  tabs,
  activeKey,
  onChange,
  className = "",
  variant = "line",
  ariaLabel = "Tabs",
}: Props) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.key === activeKey);
    if (idx >= 0) {
      tabRefs.current[idx]?.focus();
    }
  }, [activeKey, tabs]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab.disabled) {
      onChange(nextTab.key);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  const baseTab =
    "flex-1 cursor-pointer px-4 py-2.5 text-center text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2";

  const variants = {
    line: "border-b border-transparent text-slate-500 hover:text-slate-900 data-[active]:border-slate-900 data-[active]:text-slate-900",
    enclosed: "text-slate-500 hover:text-slate-900 data-[active]:bg-slate-100 data-[active]:text-slate-900",
    soft: "text-slate-500 hover:text-slate-900 data-[active]:bg-slate-100 data-[active]:text-slate-900",
  };

  return (
    <div className={`flex gap-1 ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => (
        <button
          ref={(el) => { tabRefs.current[index] = el; }}
          key={tab.key}
          role="tab"
          aria-selected={tab.key === activeKey}
          aria-controls={`${tab.key}-panel`}
          id={`${tab.key}-tab`}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.key)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={`${baseTab} ${variants[variant]} ${tab.disabled ? "cursor-not-allowed opacity-40" : ""}`}
          data-active={tab.key === activeKey}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
