import { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useTheme } from "../../theme";

interface Props {
  children?: ReactNode;
}

/** A real test has no chrome: the practice screen renders bare and scrolls. */
const PRACTICE_ROUTES = [/^\/doc\/\d+\/practice$/];

/** The review workspace owns the whole viewport — it is a fixed two-pane split. */
const WORKSPACE_ROUTES = [/^\/session\/\d+\/result$/];

/** Document-like screens end with the shared footline; app-like ones don't. */
const FOOTER_ROUTES = [
  /^\/$/,
  /^\/sessions$/,
  /^\/library$/,
  /^\/mistakes$/,
  /^\/vocabulary$/,
  /^\/settings$/,
];

/**
 * App shell. Non-exam screens live inside the themed workspace with a left
 * navigation column (drawer on mobile): `<html data-theme>` carries the palette
 * and `.app-theme` maps it onto every Tailwind colour inside the tree.
 *
 * Practice and the review workspace render bare: a real test has no chrome, and
 * the split editor wants the full width. The practice screen also stays
 * unthemed on purpose — it keeps the original cool slate palette.
 */
export function AppShell({ children }: Props) {
  const { pathname } = useLocation();
  const [theme] = useTheme();

  if (WORKSPACE_ROUTES.some((re) => re.test(pathname))) {
    return (
      <div
        data-theme={theme}
        className="app-theme app-theme-wash h-[100dvh] overflow-hidden text-slate-900"
      >
        <main id="main-content" className="h-full">
          {children ?? <Outlet />}
        </main>
      </div>
    );
  }

  if (PRACTICE_ROUTES.some((re) => re.test(pathname))) {
    return (
      // `color-scheme: light` keeps native scrollbars and controls light even
      // when the stored theme is dark — this screen is always the light one.
      <div className="min-h-screen bg-slate-100 [color-scheme:light]">
        <main id="main-content">{children ?? <Outlet />}</main>
      </div>
    );
  }

  const showFooter = FOOTER_ROUTES.some((re) => re.test(pathname));

  return (
    <div
      data-theme={theme}
      className="app-theme app-theme-wash min-h-screen text-slate-900"
    >
      <div className="lg:flex">
        <AppSidebar />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <main className="flex-1" id="main-content">
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
