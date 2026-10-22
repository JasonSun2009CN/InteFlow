import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "katex/dist/katex.min.css";
import "./index.css";
import App from "./App";
import { initTheme } from "./theme";
import { readStoredLanguage } from "./lib/i18n";

// Pick up the stored theme before the first paint so there is no flash.
initTheme();
document.documentElement.lang = readStoredLanguage() === "zh" ? "zh-CN" : "en";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
