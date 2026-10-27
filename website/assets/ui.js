/* InteFlow site — theme switching.
   Default is day. The choice is stored in localStorage under "if-theme".
   The <html data-theme> attribute is set by an inline head script before
   paint; this file only handles the toggle and keeps meta in sync. */
(function () {
  "use strict";

  var KEY = "if-theme";
  var root = document.documentElement;

  function stored() {
    try {
      var forced = new URLSearchParams(window.location.search).get("theme");
      if (forced === "dark" || forced === "light") return forced;
      return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "切换到白天模式" : "切换到黑夜模式"
      );
      btn.setAttribute("title", theme === "dark" ? "白天模式" : "黑夜模式");
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#131209" : "#faf8f3");
  }

  apply(stored());

  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(KEY, next);
      } catch (e) {
        /* storage may be blocked; the switch still works for this page */
      }
      apply(next);
    });
  });
})();
