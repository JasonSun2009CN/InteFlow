import { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

interface Props {
  children?: ReactNode;
}

/** Only the practice screen is full-bleed: a real test has no chrome. */
const EXAM_ROUTES = [/^\/doc\/\d+\/practice$/];

/** Document-like screens end with the shared footline; app-like ones don't. */
const FOOTER_ROUTES = [
  /^\/$/,
  /^\/library$/,
  /^\/mistakes$/,
  /^\/vocabulary$/,
  /^\/settings$/,
];

/** The review workspace owns the whole viewport under the mobile top bar. */
const WORKSPACE_ROUTES = [/^\/session\/\d+\/result$/];

/**
 * App shell. Non-exam screens live inside the paper-and-ink workspace with a
 * left navigation column (drawer on mobile). The practice screen renders bare
 * and keeps the original cool slate look.
 */
export function AppShell({ children }: Props) {
  const { pathname } = useLocation();

  if (EXAM_ROUTES.some((re) => re.test(pathname))) {
    return (
      <div className="min-h-screen bg-slate-100">
        <main id="main-content">{children ?? <Outlet />}</main>
      </div>
    );
  }

  const showFooter = FOOTER_ROUTES.some((re) => re.test(pathname));
  const workspace = WORKSPACE_ROUTES.some((re) => re.test(pathname));

  return (
    <div className="paper-app paper-wash min-h-screen text-slate-900">
      <div className="lg:flex">
        <AppSidebar />

        <div
          className={
            workspace
              ? "flex h-[calc(100dvh-3.5rem)] min-w-0 flex-1 flex-col overflow-hidden lg:h-dvh"
              : "flex min-h-screen min-w-0 flex-1 flex-col"
          }
        >
          <main
            className={workspace ? "min-h-0 flex-1 overflow-hidden" : "flex-1"}
            id="main-content"
          >
            {children ?? <Outlet />}
          </main>

          {showFooter && (
            <footer className="border-t border-slate-200">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 px-6 py-6 text-[11px] leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <p>InteFlow — local-first practice, review &amp; vocabulary.</p>
                <p>No accounts. No cloud. Everything stays on this machine.</p>
              </div>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
