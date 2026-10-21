/*
 * InteFlow — project website
 * Plain JavaScript, no dependencies. Everything degrades gracefully:
 * without JS the page is readable, the FAQ works, and the first theme
 * preview is still visible.
 */
(function () {
  "use strict";

  var doc = document;
  var header = doc.querySelector("[data-header]");
  var progress = doc.querySelector("[data-progress]");
  var menuBtn = doc.querySelector("[data-menu]");
  var nav = doc.getElementById("site-nav");
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------ header + bar */

  function closeMenu() {
    if (!header || !menuBtn) return;
    header.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "打开导航");
  }

  function onScroll() {
    var y = window.scrollY || doc.documentElement.scrollTop || 0;
    if (header) header.classList.toggle("is-scrolled", y > 8);
    if (progress) {
      var max = doc.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }
    updateActiveNav(y);
  }

  if (menuBtn && header) {
    menuBtn.addEventListener("click", function () {
      var open = !header.classList.contains("is-open");
      header.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    });
  }

  if (nav) {
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
  }

  doc.addEventListener("click", function (event) {
    if (header && !header.contains(event.target)) closeMenu();
  });

  doc.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  /* ------------------------------------------------------------- active nav */

  var navLinks = nav
    ? Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'))
    : [];
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href").slice(1);
      var el = doc.getElementById(id);
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  function updateActiveNav(y) {
    if (!sections.length) return;
    var current = null;
    var probe = y + 140;

    sections.forEach(function (item) {
      if (item.el.offsetTop <= probe) current = item;
    });

    if (!current && y < 200) current = null;

    navLinks.forEach(function (link) {
      link.classList.toggle("is-active", !!current && link === current.link);
    });
  }

  /* --------------------------------------------------------------- reveals */

  var revealEls = Array.prototype.slice.call(doc.querySelectorAll(".reveal"));

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.06 }
    );

    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ----------------------------------------------------------- number count */

  function countUp(el) {
    var raw = el.textContent.trim();
    var target = parseInt(raw.replace(/,/g, ""), 10);
    if (!isFinite(target) || target === 0 || raw.indexOf(",") === -1 && target < 10) {
      return;
    }

    if (reduceMotion) return;

    var start = null;
    var duration = 760;

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (p < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.textContent = raw;
      }
    }

    el.textContent = "0";
    window.requestAnimationFrame(frame);
  }

  var countEls = Array.prototype.slice.call(
    doc.querySelectorAll(".number-item strong, .hero-facts strong")
  );

  if (!reduceMotion && "IntersectionObserver" in window) {
    var countObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          countUp(entry.target);
          countObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    countEls.forEach(function (el) {
      countObserver.observe(el);
    });
  }

  /* -------------------------------------------------------- feature filters */

  var filters = Array.prototype.slice.call(doc.querySelectorAll("[data-filter]"));
  var cards = Array.prototype.slice.call(doc.querySelectorAll("[data-cat]"));
  var filterCount = doc.querySelector("[data-filter-count]");

  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      var cat = button.getAttribute("data-filter");
      var shown = 0;

      filters.forEach(function (other) {
        var active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });

      cards.forEach(function (card) {
        var show = cat === "all" || card.getAttribute("data-cat") === cat;
        card.classList.toggle("is-hidden", !show);
        if (show) {
          shown += 1;
          card.classList.add("is-visible");
        }
      });

      if (filterCount) filterCount.textContent = "显示 " + shown + " 项";
    });
  });

  /* ------------------------------------------------------------- theme lab */

  var THEMES = {
    "clear-blue": {
      name: "Clear Blue",
      note: "蓝白主色、干净边界，最接近考试当天熟悉的界面。默认主题。",
      href: "themes/clear-blue.html",
      palette: ["#f2f5f9", "#ffffff", "#0057b8", "#101c30"]
    },
    "paper-ink": {
      name: "Paper & Ink",
      note: "暖纸底、衬线标题、单一印章红。像一本安静的印刷题册，适合长时间阅读。",
      href: "themes/paper-ink.html",
      palette: ["#faf8f3", "#fffdf8", "#9a402c", "#1c1916"]
    },
    "minimal-light": {
      name: "Minimal Light",
      note: "中性灰白、无装饰、信息密度最高。接近 Notion / Linear，长时间刷题不累眼。",
      href: "themes/minimal-light.html",
      palette: ["#ffffff", "#fbfbfa", "#1f1f1f", "#191919"]
    },
    "midnight-navy": {
      name: "Midnight Navy",
      note: "深海军蓝暗色学术界面，冷调蓝色高亮，低眩光边界。适合夜间或暗色偏好。",
      href: "themes/midnight-navy.html",
      palette: ["#0a1120", "#111a2c", "#7aa2f7", "#e8edf7"]
    },
    "warm-editorial": {
      name: "Warm Editorial",
      note: "奶油底色、陶土色强调、大字排版。比纸墨更活泼，偏杂志与阅读感。",
      href: "themes/warm-editorial.html",
      palette: ["#f7efe2", "#fffbf3", "#b4552b", "#241c15"]
    }
  };

  var themeButtons = Array.prototype.slice.call(
    doc.querySelectorAll("[data-theme-id]")
  );
  var themeFrame = doc.getElementById("theme-preview");
  var themeName = doc.querySelector("[data-theme-name]");
  var themeNote = doc.querySelector("[data-theme-note]");
  var themePalette = doc.querySelector("[data-theme-palette]");
  var themeOpen = doc.querySelector("[data-theme-open]");
  var themeLoading = doc.querySelector("[data-theme-loading]");
  var themeScreen = doc.querySelector(".browser-screen");
  var activeTheme = "clear-blue";
  var themeLoadTimer = null;

  function fitThemeFrame() {
    if (!themeFrame || !themeScreen) return;
    var scale = themeScreen.clientWidth / 1320;
    themeFrame.style.transform = "scale(" + scale + ")";
  }

  function paintTheme(id) {
    var theme = THEMES[id];
    if (!theme || !themeFrame) return;
    activeTheme = id;

    themeButtons.forEach(function (button) {
      var active = button.getAttribute("data-theme-id") === id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });

    if (themeName) themeName.textContent = theme.name;
    if (themeNote) themeNote.textContent = theme.note;
    if (themeOpen) themeOpen.setAttribute("href", theme.href);
    if (themePalette) {
      themePalette.innerHTML = theme.palette
        .map(function (color) {
          return (
            '<span class="swatch"><i style="background:' +
            color +
            '"></i><span>' +
            color +
            "</span></span>"
          );
        })
        .join("");
    }

    if (themeLoading) themeLoading.classList.remove("is-ready");
    themeFrame.title = theme.name + " 主题预览";
    themeFrame.src = theme.href;
    fitThemeFrame();

    window.clearTimeout(themeLoadTimer);
    themeLoadTimer = window.setTimeout(function () {
      if (themeLoading) themeLoading.classList.add("is-ready");
    }, 6000);
  }

  if (themeFrame) {
    themeFrame.addEventListener("load", function () {
      fitThemeFrame();
      window.clearTimeout(themeLoadTimer);
      if (themeLoading) themeLoading.classList.add("is-ready");
    });

    paintTheme(activeTheme);

    themeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-theme-id");
        if (id && id !== activeTheme) paintTheme(id);
      });

      button.addEventListener("keydown", function (event) {
        var index = themeButtons.indexOf(button);
        var next = null;

        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          next = themeButtons[(index + 1) % themeButtons.length];
        } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          next = themeButtons[(index - 1 + themeButtons.length) % themeButtons.length];
        }

        if (!next) return;
        event.preventDefault();
        next.focus();
        var id = next.getAttribute("data-theme-id");
        if (id) paintTheme(id);
      });
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(fitThemeFrame, 80);
    });

    if ("ResizeObserver" in window && themeScreen) {
      new ResizeObserver(fitThemeFrame).observe(themeScreen);
    }

    window.addEventListener("load", fitThemeFrame);
    fitThemeFrame();
  }

  /* ------------------------------------------------------------- code tabs */

  var codeTabs = Array.prototype.slice.call(doc.querySelectorAll("[data-code-tab]"));
  var codePanes = Array.prototype.slice.call(doc.querySelectorAll("[data-code-pane]"));

  function openCodeTab(name) {
    codeTabs.forEach(function (tab) {
      var active = tab.getAttribute("data-code-tab") === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    codePanes.forEach(function (pane) {
      pane.classList.toggle("is-active", pane.getAttribute("data-code-pane") === name);
    });
  }

  codeTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      openCodeTab(tab.getAttribute("data-code-tab"));
    });
  });

  /* ------------------------------------------------------------------ copy */

  function fallbackCopy(text) {
    var area = doc.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    doc.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = doc.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    doc.body.removeChild(area);
    return ok;
  }

  function copyText(text, button) {
    var original = button.textContent;
    var done = function () {
      button.textContent = "已复制";
      button.classList.add("is-copied");
      window.setTimeout(function () {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1600);
    };
    var fail = function () {
      button.textContent = "复制失败";
      window.setTimeout(function () {
        button.textContent = original;
      }, 1600);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () {
        if (fallbackCopy(text)) done();
        else fail();
      });
    } else if (fallbackCopy(text)) {
      done();
    } else {
      fail();
    }
  }

  Array.prototype.forEach.call(doc.querySelectorAll("[data-copy]"), function (button) {
    button.addEventListener("click", function () {
      copyText(button.getAttribute("data-copy"), button);
    });
  });

  var copyPanel = doc.querySelector("[data-copy-panel]");
  if (copyPanel) {
    copyPanel.addEventListener("click", function () {
      var active = doc.querySelector(".code-pane.is-active code");
      if (active) copyText(active.textContent, copyPanel);
    });
  }

  /* ------------------------------------------------------------------ init */

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  window.__inteflowSiteReady = true;
})();
