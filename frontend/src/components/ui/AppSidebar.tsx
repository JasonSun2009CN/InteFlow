import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bookmark,
  GraduationCap,
  History,
  Languages,
  Library,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  X,
} from "lucide-react";

/** Desktop sidebar compact mode (icons only). Mobile always uses the drawer. */
export const SIDEBAR_COMPACT_KEY = "inteflow.sidebar.compact";

interface NavItem {
  to: string;
  label: string;
  icon: typeof GraduationCap;
  /** Match only the exact path (used for the index route). */
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Exams", icon: GraduationCap, end: true },
  { to: "/sessions", label: "Sessions", icon: History },
  { to: "/library", label: "Library", icon: Library },
  { to: "/mistakes", label: "Review", icon: Bookmark },
  { to: "/vocabulary", label: "Vocabulary", icon: Languages },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function isActive(pathname: string, item: NavItem): boolean {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="InteFlow"
      className={`inline-flex items-center gap-2.5 ${
        compact ? "lg:justify-center" : ""
      }`}
    >
      <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        className={`h-6 w-6 shrink-0 ${compact ? "lg:h-8 lg:w-8" : ""}`}
      />
      <span
        className={`font-display text-lg tracking-tight text-slate-900 ${
          compact ? "lg:hidden" : ""
        }`}
      >
        InteFlow
      </span>
    </Link>
  );
}

/**
 * Workspace navigation. Fixed left column on wide screens; a top bar plus a
 * slide-in drawer on narrow ones. The active tab is derived from the route.
 */
export function AppSidebar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COMPACT_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COMPACT_KEY, compact ? "1" : "0");
    } catch {
      /* private mode / disabled storage: compact mode still works this visit */
    }
  }, [compact]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="-ml-1 rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Brand />
      </header>

      {open && (
        <div
          className="scrim fixed inset-0 z-40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        id="app-sidebar"
        aria-label="Main"
        data-compact={compact ? "true" : "false"}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] -translate-x-full flex-col gap-6 overflow-y-auto border-r border-slate-200 bg-white px-5 py-6 transition-all duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:max-w-none lg:translate-x-0 ${
          compact ? "lg:w-20 lg:px-2" : "lg:w-64"
        } ${open ? "translate-x-0" : ""}`}
      >
        <div
          className={`flex items-center justify-between gap-2 ${
            compact ? "lg:flex-col lg:gap-3" : ""
          }`}
        >
          <Brand compact={compact} />
          <button
            type="button"
            onClick={() => setCompact((value) => !value)}
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            title={compact ? "Expand sidebar" : "Collapse sidebar"}
            aria-controls="app-sidebar"
            aria-expanded={!compact}
            className="hidden rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
          >
            {compact ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <ul className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  title={compact ? item.label : undefined}
                  className={`nav-item relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    compact ? "lg:justify-center lg:px-0" : ""
                  } ${
                    active
                      ? "is-active bg-slate-100 font-medium text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {active && (
                    <span
                      className="nav-marker absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-seal-600"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className={compact ? "lg:hidden" : ""}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div
          className={`mt-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-500 ${
            compact ? "lg:hidden" : ""
          }`}
        >
          <p className="font-medium text-slate-700">Local-first</p>
          <p>Everything stays on this machine.</p>
        </div>
      </nav>
    </>
  );
}
