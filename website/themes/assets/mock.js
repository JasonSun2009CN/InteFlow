/*
 * InteFlow — theme example mockup
 * ---------------------------------------------------------------------------
 * Every theme page renders the *same* home screen (Exams tab) so only the
 * visual language changes. Plain HTML/CSS/JS: no build step, no dependencies.
 *
 * Usage from a theme page:
 *   <link rel="stylesheet" href="assets/base.css">
 *   <link rel="stylesheet" href="assets/themes/clear-blue.css">
 *   <script src="assets/mock.js"></script>
 *   <script>InteFlowMock.mount({ theme: "clear-blue" });</script>
 */
(function () {
  "use strict";

  var backHref = /[?&]lang=en(?:&|$)/.test(window.location.search)
    ? "../en.html"
    : "../index.html";

  /* ---------------------------------------------------------------- themes */

  var THEMES = [
    {
      id: "clear-blue",
      name: "Clear Blue",
      file: "clear-blue.html",
      note: "The default: clear blue, crisp rules, exam-day familiarity."
    },
    {
      id: "paper-ink",
      name: "Paper & Ink",
      file: "paper-ink.html",
      note: "Warm paper, serif headings, one seal-red accent. A printed booklet."
    },
    {
      id: "minimal-light",
      name: "Minimal Light",
      file: "minimal-light.html",
      note: "Neutral greys and dense rows. Notion / Linear territory."
    },
    {
      id: "midnight-navy",
      name: "Midnight Navy",
      file: "midnight-navy.html",
      note: "Dark academic: deep navy ground, cool highlight, low glare."
    },
    {
      id: "warm-editorial",
      name: "Warm Editorial",
      file: "warm-editorial.html",
      note: "Cream ground, terracotta accent, large serif type. A magazine."
    }
  ];

  /* ------------------------------------------------------------------ data */

  var NAV = [
    { id: "exams", label: "Exams", icon: "cap" },
    { id: "library", label: "Library", icon: "books" },
    { id: "sessions", label: "Sessions", icon: "history" },
    { id: "review", label: "Review", icon: "star" },
    { id: "vocabulary", label: "Vocabulary", icon: "langs" },
    { id: "settings", label: "Settings", icon: "sliders" }
  ];

  var EXAMS = [
    {
      title: "25年10月北美 · Routing A",
      questions: 54,
      added: "Oct 12, 2026",
      key: { answered: 12, total: 54 }
    },
    {
      title: "25年9月亚太 · Harder B",
      questions: 54,
      added: "Oct 9, 2026",
      key: null
    },
    {
      title: "25年8月北美 · Routing A",
      questions: 54,
      added: "Oct 3, 2026",
      key: null
    },
    {
      title: "2025 SAT 语文 · 全真模拟 1",
      questions: 66,
      added: "Sep 28, 2026",
      key: { answered: 40, total: 66 }
    },
    {
      title: "25年7月亚太 · Harder A",
      questions: 54,
      added: "Sep 20, 2026",
      key: null
    }
  ];

  var PLACEHOLDERS = {
    library: {
      title: "Library",
      text: "Import a PDF, DOCX or InteFlow-MD file, or add a ready-made set from the built-in bank.",
      cta: "Import a file"
    },
    sessions: {
      title: "Sessions",
      text: "Every submitted attempt, newest first. Search it, reopen the review, or delete the record.",
      cta: "Open sessions"
    },
    review: {
      title: "Review",
      text: "Mistakes and starred questions share one analysis editor. Search, filter, and sort both sets.",
      cta: "Open review"
    },
    vocabulary: {
      title: "Vocabulary",
      text: "One word list per exam set. Words you add while reviewing land in the set they came from.",
      cta: "Open word lists"
    },
    settings: {
      title: "Settings",
      text: "AI provider, model and API key for optional actions. Everything else stays on this machine.",
      cta: "Configure providers"
    }
  };

  /* ----------------------------------------------------------------- icons */

  var ICONS = {
    cap:
      '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/>',
    books:
      '<path d="M4 19V5a2 2 0 0 1 2-2h2v16H6a2 2 0 0 0-2 2Z"/><path d="M8 3h4v16H8z"/><path d="M12 5.5 16.5 4l3.5 14-4.5 1.5Z"/>',
    "circle-x":
      '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    history:
      '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 7v5l3 2"/>',
    star:
      '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>',
    langs:
      '<path d="M3 6h9M7.5 6c0 4-1.5 7-4.5 9"/><path d="M5 12c1.5 2.5 3.5 4 6 5"/><path d="m12.5 20 4-9 4 9"/><path d="M14 17h5"/>',
    sliders:
      '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    check: '<path d="m5 13 4 4L19 7"/>'
  };

  function icon(name, extra) {
    return (
      '<svg class="ic ' +
      (extra || "") +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICONS[name] +
      "</svg>"
    );
  }

  /* ------------------------------------------------------------- fragments */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function sidebar(state) {
    var nav = NAV.map(function (item) {
      var active = item.id === state.tab;
      return (
        '<button type="button" class="nav-item' +
        (active ? " is-active" : "") +
        '" data-tab="' +
        item.id +
        '"' +
        (active ? ' aria-current="page"' : "") +
        ">" +
        icon(item.icon) +
        "<span>" +
        item.label +
        "</span></button>"
      );
    }).join("");

    var options = THEMES.map(function (theme) {
      return (
        '<option value="' +
        theme.file +
        '"' +
        (theme.id === state.theme ? " selected" : "") +
        ">" +
        esc(theme.name) +
        "</option>"
      );
    }).join("");

    return (
      '<a class="brand" href="' +
      backHref +
      '" title="Back to the InteFlow website">' +
      '<span class="brand-mark">IF</span>' +
      '<span class="brand-name">InteFlow</span>' +
      "</a>" +
      '<nav class="nav" aria-label="Main">' +
      nav +
      "</nav>" +
      '<div class="sidebar-foot">' +
      '<label class="theme-pick">' +
      '<span class="theme-pick-label">Theme</span>' +
      '<select data-theme-pick aria-label="Switch theme">' +
      options +
      "</select>" +
      "</label>" +
      '<p class="sidebar-note"><strong>Theme preview</strong><br>Real components, same data as the gallery.</p>' +
      '<a class="preview-back" href="' +
      backHref +
      '">← Back to the website</a>' +
      "</div>"
    );
  }

  function stat(label, value, tone) {
    return (
      '<div class="stat">' +
      '<span class="stat-label">' +
      label +
      "</span>" +
      '<span class="stat-value' +
      (tone ? " is-" + tone : "") +
      '" data-count="' +
      value +
      '">' +
      value +
      "</span>" +
      "</div>"
    );
  }

  function examRow(exam, index, state) {
    // Each meta piece is its own flex item, so wrapping never strands a "·".
    var meta = [
      '<span class="meta-item exam-count">' + exam.questions + " questions</span>",
      '<span class="meta-item">Added ' + esc(exam.added) + "</span>"
    ];

    if (exam.key) {
      meta.push(
        '<span class="meta-item key-warn">Answer key ' +
          exam.key.answered +
          "/" +
          exam.key.total +
          "</span>"
      );
    }

    return (
      '<li class="exam-row">' +
      '<span class="exam-index">' +
      String(index + 1).padStart(2, "0") +
      "</span>" +
      '<div class="exam-body">' +
      '<h3 class="exam-title"><a href="#" data-start="' +
      esc(exam.title) +
      '">' +
      esc(exam.title) +
      "</a></h3>" +
      '<p class="exam-meta">' +
      meta.join("") +
      "</p>" +
      "</div>" +
      '<div class="exam-actions">' +
      (exam.key
        ? '<button type="button" class="link" data-answers="' + esc(exam.title) + '">Enter answers</button>'
        : "") +
      '<button type="button" class="btn btn-primary" data-start="' +
      esc(exam.title) +
      '">Start' +
      icon("arrow") +
      "</button>" +
      "</div>" +
      "</li>"
    );
  }

  /** Exams matching the current filter, in their original order. */
  function visibleExams(state) {
    var query = state.query.trim().toLowerCase();
    return EXAMS.filter(function (exam) {
      return !query || exam.title.toLowerCase().indexOf(query) !== -1;
    });
  }

  function listHtml(state) {
    var rows = visibleExams(state);
    if (!rows.length) {
      return (
        '<p class="empty">No exam matches “' + esc(state.query.trim()) + '”.</p>'
      );
    }
    return (
      '<ol class="exam-list">' +
      rows
        .map(function (exam) {
          return examRow(exam, EXAMS.indexOf(exam), state);
        })
        .join("") +
      "</ol>"
    );
  }

  function countHtml(state) {
    return visibleExams(state).length + " of " + EXAMS.length;
  }

  function examsView(state) {
    var questions = EXAMS.reduce(function (sum, exam) {
      return sum + exam.questions;
    }, 0);
    var needsKeys = EXAMS.filter(function (exam) {
      return exam.key;
    }).length;

    var banner = state.bannerDismissed
      ? ""
      : '<div class="banner" role="status">' +
        '<span class="banner-icon">' +
        icon("alert") +
        "</span>" +
        '<div class="banner-body">' +
        '<p class="banner-title">2 exams still need answer keys</p>' +
        '<p class="banner-text">You can start them now — grading waits until the key is complete.</p>' +
        "</div>" +
        '<button type="button" class="banner-dismiss" data-dismiss aria-label="Dismiss">' +
        icon("close") +
        "</button>" +
        "</div>";

    return (
      '<section class="hero">' +
      '<div class="hero-text">' +
      '<p class="eyebrow">Local practice workspace</p>' +
      '<h1 class="title">Select an exam</h1>' +
      '<p class="lede">Answers are graded when you submit. The timer starts when you begin — and everything stays on this machine.</p>' +
      "</div>" +
      '<div class="stats">' +
      stat("Exams", EXAMS.length) +
      stat("Questions", questions) +
      stat("Needs keys", needsKeys, "warn") +
      "</div>" +
      "</section>" +
      banner +
      '<section class="section">' +
      '<div class="section-head">' +
      '<h2 class="section-title">Exams</h2>' +
      '<p class="section-note">Answers are graded when you submit</p>' +
      "</div>" +
      '<div class="toolbar">' +
      '<label class="search">' +
      icon("search") +
      '<input type="search" placeholder="Filter exams…" value="' +
      esc(state.query) +
      '" data-search aria-label="Filter exams">' +
      "</label>" +
      '<span class="toolbar-count" data-list-count>' +
      countHtml(state) +
      "</span>" +
      "</div>" +
      '<div data-list>' +
      listHtml(state) +
      "</div>" +
      "</section>"
    );
  }

  function placeholderView(tab) {
    var data = PLACEHOLDERS[tab];
    return (
      '<section class="hero">' +
      '<div class="hero-text">' +
      '<p class="eyebrow">Workspace</p>' +
      '<h1 class="title">' +
      data.title +
      "</h1>" +
      '<p class="lede">' +
      data.text +
      "</p>" +
      '<p class="placeholder-cta"><button type="button" class="btn btn-primary" data-start="' +
      data.cta +
      '">' +
      data.cta +
      icon("arrow") +
      "</button></p>" +
      "</div>" +
      "</section>" +
      '<section class="section">' +
      '<div class="section-head">' +
      '<h2 class="section-title">Soon</h2>' +
      '<p class="section-note">Placeholder — this page exists to show the chrome</p>' +
      "</div>" +
      '<div class="skeleton">' +
      '<span class="skeleton-line w70"></span>' +
      '<span class="skeleton-line w45"></span>' +
      '<span class="skeleton-line w60"></span>' +
      "</div>" +
      "</section>"
    );
  }

  function footer() {
    return (
      '<footer class="footline">' +
      "<p>InteFlow — local-first practice, review &amp; vocabulary.</p>" +
      "<p>No accounts. No cloud. Everything stays on this machine.</p>" +
      "</footer>"
    );
  }

  /* ----------------------------------------------------------- behaviours */

  function mount(options) {
    var opts = options || {};
    var root = document.getElementById(opts.rootId || "app");
    if (!root) return;

    var state = {
      theme: opts.theme || "clear-blue",
      tab: "exams",
      query: "",
      bannerDismissed: false,
      counted: false
    };

    function paint() {
      root.className = "app";
      root.dataset.theme = state.theme;
      root.innerHTML =
        '<div class="scrim" data-scrim hidden></div>' +
        '<aside class="sidebar" id="app-sidebar">' +
        sidebar(state) +
        "</aside>" +
        '<div class="col">' +
        '<header class="mobilebar">' +
        '<button type="button" class="icon-btn" data-menu aria-label="Open menu" aria-controls="app-sidebar">' +
        icon("menu") +
        "</button>" +
        '<span class="mobilebar-brand">InteFlow</span>' +
        "</header>" +
        '<main class="main">' +
        '<div class="content">' +
        (state.tab === "exams" ? examsView(state) : placeholderView(state.tab)) +
        "</div>" +
        footer() +
        "</main>" +
        "</div>" +
        '<div class="toasts" id="toasts" aria-live="polite"></div>';

      if (!state.counted) {
        state.counted = true;
        countUp(root);
      }
      document.title = "InteFlow — " + themeName(state.theme) + " theme preview";
    }

    function themeName(id) {
      for (var i = 0; i < THEMES.length; i++) {
        if (THEMES[i].id === id) return THEMES[i].name;
      }
      return id;
    }

    /* Numbers tick up once, unless the visitor asked for less motion. */
    function countUp(scope) {
      var reduce =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var nodes = scope.querySelectorAll("[data-count]");
      Array.prototype.forEach.call(nodes, function (node) {
        var target = Number(node.getAttribute("data-count")) || 0;
        var width = node.textContent.length;
        var final = String(target).padStart(width, "0");

        if (reduce || target === 0) {
          node.textContent = final;
          return;
        }

        function settle() {
          node.textContent = final;
        }

        // Always land on the real number, even if animation frames are throttled.
        window.setTimeout(settle, 700);

        var started = null;
        function step(ts) {
          if (started === null) started = ts;
          var progress = Math.min((ts - started) / 600, 1);
          if (progress >= 1) {
            settle();
            return;
          }
          var eased = 1 - Math.pow(1 - progress, 3);
          node.textContent = String(Math.round(target * eased)).padStart(width, "0");
          window.requestAnimationFrame(step);
        }

        node.textContent = String(0).padStart(width, "0");
        window.requestAnimationFrame(step);
      });
    }

    function toast(message) {
      var wrap = root.querySelector("#toasts");
      if (!wrap) return;
      var el = document.createElement("div");
      el.className = "toast";
      el.innerHTML = icon("check") + "<span>" + esc(message) + "</span>";
      wrap.appendChild(el);
      window.setTimeout(function () {
        el.classList.add("is-out");
        window.setTimeout(function () {
          el.remove();
        }, 240);
      }, 2200);
    }

    function openDrawer(open) {
      root.classList.toggle("drawer-open", open);
      var scrim = root.querySelector("[data-scrim]");
      if (scrim) scrim.hidden = !open;
    }

    root.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-tab]");
      if (tab) {
        state.tab = tab.getAttribute("data-tab");
        state.query = "";
        paint();
        openDrawer(false);
        return;
      }

      var start = event.target.closest("[data-start]");
      if (start) {
        event.preventDefault();
        toast("Demo only — “" + start.getAttribute("data-start") + "”");
        return;
      }

      var answers = event.target.closest("[data-answers]");
      if (answers) {
        toast("Answer key editor is not part of this mockup");
        return;
      }

      if (event.target.closest("[data-dismiss]")) {
        state.bannerDismissed = true;
        paint();
        return;
      }

      if (event.target.closest("[data-menu]")) {
        openDrawer(!root.classList.contains("drawer-open"));
        return;
      }

      if (event.target.closest("[data-scrim]")) openDrawer(false);
    });

    root.addEventListener("input", function (event) {
      if (!event.target.matches("[data-search]")) return;
      state.query = event.target.value;
      // Update only the list so the caret stays where the visitor left it.
      var region = root.querySelector("[data-list]");
      if (region) region.innerHTML = listHtml(state);
      var count = root.querySelector("[data-list-count]");
      if (count) count.textContent = countHtml(state);
    });

    root.addEventListener("change", function (event) {
      if (!event.target.matches("[data-theme-pick]")) return;
      window.location.href = event.target.value;
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") openDrawer(false);
      if (
        event.key === "/" &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
      ) {
        var search = root.querySelector("[data-search]");
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    });

    paint();
  }

  window.InteFlowMock = {
    mount: mount,
    themes: THEMES,
    // Exposed so the gallery can reuse the exact same exam titles.
    exams: EXAMS
  };
})();
