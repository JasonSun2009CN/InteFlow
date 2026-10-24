/**
 * API exposed by the Electron preload bridge (`desktop/preload.cjs`).
 *
 * These globals are absent in the browser build, so every consumer must check
 * `window.inteflow?.desktop` first. User data stays in the main process.
 */
export {};

declare global {
  interface Window {
    inteflow?: {
      desktop?: boolean;
      platform?: string;
      electron?: string;
      /**
       * Ask the desktop shell to clear local data and restart. Resolves after
       * the app restarts (or with `{ cancelled: true }` if the user backs out).
       */
      resetData?: () => Promise<{ ok: boolean; cancelled?: boolean }>;
    };
  }
}
