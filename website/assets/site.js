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
  var isEnglish = /^en/i.test(doc.documentElement.lang || "");
  var COPY = isEnglish
    ? {
        openNav: "Open navigation",
        closeNav: "Close navigation",
        showCount: function (shown) {
          return "Showing " + shown + " items";
        },
        copied: "Copied",
        copyFailed: "Copy failed",
        themePreview: " theme preview"
      }
    : {
        openNav: "打开导航",
        closeNav: "关闭导航",
        showCount: function (shown) {
          return "显示 " + shown + " 项";
        },
        copied: "已复制",
        copyFailed: "复制失败",
        themePreview: " 主题预览"
      };

  function langHref(href) {
    if (!isEnglish) return href;
    return href + (href.indexOf("?") === -1 ? "?" : "&") + "lang=en";
  }

  /* ------------------------------------------------------------ header + bar */

  function closeMenu() {
    if (!header || !menuBtn) return;
    header.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", COPY.openNav);
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
      menuBtn.setAttribute("aria-label", open ? COPY.closeNav : COPY.openNav);
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

      if (filterCount) filterCount.textContent = COPY.showCount(shown);
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

  if (isEnglish) {
    var THEME_NOTES_EN = {
      "clear-blue": "Blue and white, clean borders — the closest to the interface you know from test day. The default theme.",
      "paper-ink": "Warm paper, serif headings and a single stamp red. Like a quiet printed workbook, made for long reading sessions.",
      "minimal-light": "Neutral greys, no ornament, maximum information density. Close to Notion / Linear and easy on the eyes over long sessions.",
      "midnight-navy": "A dark navy academic interface with cool blue highlights and low-glare borders. For night sessions or a dark-mode preference.",
      "warm-editorial": "Cream background, terracotta accents and large type. Livelier than Paper & Ink, with a magazine-like reading feel."
    };
    Object.keys(THEME_NOTES_EN).forEach(function (id) {
      if (THEMES[id]) THEMES[id].note = THEME_NOTES_EN[id];
    });
  }

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
    if (themeOpen) themeOpen.setAttribute("href", langHref(theme.href));
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
    themeFrame.title = theme.name + COPY.themePreview;
    themeFrame.src = langHref(theme.href);
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
      button.textContent = COPY.copied;
      button.classList.add("is-copied");
      window.setTimeout(function () {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1600);
    };
    var fail = function () {
      button.textContent = COPY.copyFailed;
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

  /* ------------------------------------------------------------------ demo */

  var demoRoot = doc.querySelector("[data-demo]");

  if (demoRoot) {
    var DEMO = isEnglish
      ? {
          ui: {
            title: "Demo · Mixed Practice",
            subtitle: "Reading & Writing · 4 questions",
            questionOf: function (number, total) {
              return "Question " + number + " of " + total;
            },
            questionHeading: function (number, section, kind) {
              return "Question " + number + " · " + section + " · " + kind;
            },
            palette: "Question palette",
            passage: "Passage",
            exit: "Exit",
            submit: "Submit",
            prev: "Previous",
            next: "Next",
            star: "☆ Star for review",
            starred: "★ Starred",
            resultKicker: "RESULT · 0 TOKEN",
            resultSubtitle: "Submitted · graded locally · 0 token",
            resultNote: function (correct, total) {
              return correct + " of " + total + " correct";
            },
            timeNote: function (time) {
              return "Time " + time;
            },
            scoreDetail: function (pct, wrong) {
              return pct + "% · " + wrong + " wrong";
            },
            reviewSubtitle: function (time, total, graded) {
              return time + " · " + total + " questions · " + graded + " graded";
            },
            reviewBtn: "Review answers",
            againBtn: "Practice again",
            back: "Back",
            review: "Review",
            correctTag: "Correct",
            wrongTag: "Wrong",
            yourAnswer: "Your answer",
            correctAnswer: "Correct answer",
            notAnswered: "No answer",
            correctOption: "Correct",
            yourOption: "Your answer",
            accepted: "Accepted answers",
            analysis: "ANALYSIS",
            write: "Write",
            preview: "Preview",
            analysisNote:
              "Demo: edits stay on this page. The real editor autosaves after about 0.9s and can export md / docx / pdf.",
            wordBank: "WORD BANK",
            words: function (n) {
              return n + " saved";
            },
            vocabNote: "Tap + to keep a word in this browser. Nothing leaves the page.",
            addWord: "Add to word bank",
            addedWord: "Saved",
            aiTitle: "AI Tutor",
            aiTagline: "Explicit by design. The main path stays local and 0-token.",
            aiButton: "Explain this question",
            aiNote:
              "Demo response. The real app sends only this question's context to your configured provider, and only when you click.",
            toolQuestion: "Question",
            toolAnalysis: "Analysis",
            toolAi: "AI Tutor",
            toolVocabulary: "Vocabulary",
            notebook: "Notebook",
            export: "Export",
            toastNotebook:
              "Demo only — the full app opens a Notebook preview and exports md / docx / pdf.",
            toastExport:
              "Demo only — the full app exports notebooks as md / docx / pdf and word lists as xlsx.",
            toastExit:
              "Demo only — in the full app, Exit leaves practice and discards an unsubmitted attempt.",
            blankPlaceholder: "Type one word…",
            blankHint: "One word. Case and surrounding spaces do not matter."
          },
          questions: [
            {
              section: "READING",
              kindLabel: "Attitude",
              material:
                "The committee had reservations about the new policy, and those reservations were not unreasonable. Still, the policy was adopted without amendment, and its first month has gone better than critics predicted.",
              stem: "The author's attitude toward the new policy is best described as",
              options: [
                { key: "A", text: "undisguised contempt" },
                { key: "B", text: "cautious approval" },
                { key: "C", text: "outright indifference" },
                { key: "D", text: "blunt hostility" }
              ],
              answer: "B",
              analysis:
                "The author concedes that the committee's concerns were “not unreasonable”, then signals a turn with “Still”: the policy passed unchanged and outperformed predictions. That is measured approval — not contempt, indifference or hostility.\n\nConcession + “still” is a common pattern: acknowledge the other side, then land on a qualified but clear position.",
              ai:
                "Find the turn: “not unreasonable” concedes, “Still” states the author's position. The policy passed unchanged and beat predictions — so this is qualified approval.",
              words: [
                { term: "reservations", pos: "n.", def: "doubts or concerns held back" },
                { term: "amendment", pos: "n.", def: "a formal change to a text" },
                { term: "contempt", pos: "n.", def: "the feeling that someone is worthless" }
              ]
            },
            {
              section: "READING",
              kindLabel: "Words in context",
              material:
                "The committee had reservations about the new policy, and those reservations were not unreasonable. Still, the policy was adopted without amendment, and its first month has gone better than critics predicted.",
              stem: "As used in the sentence, “reservations” most nearly means",
              options: [
                { key: "A", text: "bookings" },
                { key: "B", text: "doubts" },
                { key: "C", text: "approvals" },
                { key: "D", text: "restrictions" }
              ],
              answer: "B",
              analysis:
                "The sentence contrasts the committee's reservations with the policy's smooth first month. A reservation in this sense is a doubt held back — not a booking, an approval or a restriction. The next clause, “those reservations were not unreasonable”, confirms that these are concerns.\n\nSubstitute “doubts” back into the sentence: “the committee had doubts about the new policy.” The logic still holds.",
              ai:
                "Substitute each option back into the sentence. Only “doubts” keeps both the conceding clause and the contrast with the policy's success.",
              words: [
                { term: "reservation", pos: "n.", def: "a doubt or objection" },
                { term: "unreasonable", pos: "adj.", def: "not fair or sensible" }
              ]
            },
            {
              section: "MATH",
              kindLabel: "Algebra",
              stem: "If 3x + 7 = 22, what is the value of x?",
              options: [
                { key: "A", text: "3" },
                { key: "B", text: "5" },
                { key: "C", text: "7" },
                { key: "D", text: "15" }
              ],
              answer: "B",
              analysis:
                "Subtract 7 from both sides: 3x = 15. Divide by 3: x = 5. Check: 3(5) + 7 = 22.\n\nThe trap is stopping early: 15 is the value of 3x, not x.",
              ai:
                "Undo the operations in reverse: subtract 7, then divide by 3. Substitute the result back into the original equation to check.",
              words: [{ term: "isolate", pos: "v.", def: "to get a variable alone on one side" }]
            },
            {
              section: "READING",
              kindLabel: "Fill-in",
              stem:
                "The scientist's ______ approach — testing every hypothesis twice — made her conclusions unusually reliable.",
              kind: "blank",
              answer: "meticulous",
              accept: [
                "meticulous",
                "careful",
                "thorough",
                "methodical",
                "rigorous",
                "scrupulous",
                "diligent"
              ],
              analysis:
                "The dash defines the blank: testing every hypothesis twice is careful, systematic work. “Meticulous” — extremely careful about detail — fits both meaning and register. “Careful”, “thorough”, “methodical” and “rigorous” are accepted too.\n\nWhen a blank is followed by a dash or colon, let the explanation choose the word.",
              ai:
                "The dash is a definition. “Testing every hypothesis twice” points to careful, systematic work; “meticulous” fits the register best.",
              words: [
                { term: "meticulous", pos: "adj.", def: "extremely careful about detail" },
                { term: "hypothesis", pos: "n.", def: "a proposed explanation to be tested" },
                { term: "reliable", pos: "adj.", def: "consistently trustworthy" }
              ]
            }
          ]
        }
      : {
          ui: {
            title: "演示 · 混合练习",
            subtitle: "Reading & Writing · 4 题",
            questionOf: function (number, total) {
              return "第 " + number + " 题 / 共 " + total + " 题";
            },
            questionHeading: function (number, section, kind) {
              return "第 " + number + " 题 · " + section + " · " + kind;
            },
            palette: "题号面板",
            passage: "文章",
            exit: "退出",
            submit: "交卷",
            prev: "上一题",
            next: "下一题",
            star: "☆ 标记待看",
            starred: "★ 已标记",
            resultKicker: "RESULT · 0 TOKEN",
            resultSubtitle: "已交卷 · 本地判分 · 0 token",
            resultNote: function (correct, total) {
              return "答对 " + correct + " / " + total + " 题";
            },
            timeNote: function (time) {
              return "用时 " + time;
            },
            scoreDetail: function (pct, wrong) {
              return pct + "% · 答错 " + wrong + " 题";
            },
            reviewSubtitle: function (time, total, graded) {
              return time + " · " + total + " 题 · 已判 " + graded + " 题";
            },
            reviewBtn: "查看复盘",
            againBtn: "再做一次",
            back: "返回",
            review: "复盘",
            correctTag: "正确",
            wrongTag: "错误",
            yourAnswer: "你的答案",
            correctAnswer: "正确答案",
            notAnswered: "未作答",
            correctOption: "正确答案",
            yourOption: "你的作答",
            accepted: "可接受答案",
            analysis: "ANALYSIS",
            write: "Write",
            preview: "Preview",
            analysisNote:
              "演示里编辑只留在本页。真实编辑器约 0.9 秒自动保存，并可导出 md / docx / pdf。",
            wordBank: "WORD BANK",
            words: function (n) {
              return "已收录 " + n + " 个";
            },
            vocabNote: "点 + 把词收进这个浏览器，0 token，不上传。",
            addWord: "加入生词本",
            addedWord: "已收录",
            aiTitle: "AI Tutor",
            aiTagline: "AI 只在显式点击后出现；主链路保持本地、0 token。",
            aiButton: "让 AI 讲解这道题",
            aiNote:
              "演示文案。真实应用只在你点击时，把当前题目上下文发给已经配置好的服务商。",
            toolQuestion: "题目",
            toolAnalysis: "分析",
            toolAi: "AI Tutor",
            toolVocabulary: "生词本",
            notebook: "Notebook",
            export: "导出",
            toastNotebook:
              "仅演示：完整应用会打开整套 Notebook 预览，并可导出 md / docx / pdf。",
            toastExport:
              "仅演示：完整应用可把复盘导出为 md / docx / pdf，词表导出为 xlsx。",
            toastExit:
              "仅演示：完整应用的 Exit 会离开练习并丢弃未交卷的作答；这里会保留你的答案。",
            blankPlaceholder: "输入一个单词…",
            blankHint: "只填一个词，大小写与首尾空格不影响判分。"
          },
          questions: [
            {
              section: "READING",
              kindLabel: "态度题",
              material:
                "The committee had reservations about the new policy, and those reservations were not unreasonable. Still, the policy was adopted without amendment, and its first month has gone better than critics predicted.",
              stem: "The author's attitude toward the new policy is best described as",
              options: [
                { key: "A", text: "undisguised contempt" },
                { key: "B", text: "cautious approval" },
                { key: "C", text: "outright indifference" },
                { key: "D", text: "blunt hostility" }
              ],
              answer: "B",
              analysis:
                "作者先承认委员会的顾虑 “not unreasonable”，再用 “Still” 转折：政策原样通过，而且头一个月比批评者预测的更好。这是有保留的赞同（cautious approval），不是轻蔑、漠然或敌意。\n\n“让步 + still” 是态度题的常见结构：先承认对方，再落到一个有保留但明确的立场。",
              ai:
                "先找转折：“not unreasonable” 是让步，“Still” 才是作者立场。政策原样通过、表现好于预期，所以是有保留的赞同。",
              words: [
                { term: "reservations", pos: "n.", def: "疑虑；保留意见（doubts held back）" },
                { term: "amendment", pos: "n.", def: "修正；对文本的正式修改" },
                { term: "contempt", pos: "n.", def: "轻蔑；藐视" }
              ]
            },
            {
              section: "READING",
              kindLabel: "词义题",
              material:
                "The committee had reservations about the new policy, and those reservations were not unreasonable. Still, the policy was adopted without amendment, and its first month has gone better than critics predicted.",
              stem: "As used in the sentence, “reservations” most nearly means",
              options: [
                { key: "A", text: "bookings" },
                { key: "B", text: "doubts" },
                { key: "C", text: "approvals" },
                { key: "D", text: "restrictions" }
              ],
              answer: "B",
              analysis:
                "句子把委员会的 reservations 与政策头一个月的顺利表现作对比。这里的 reservation 是保留在心里的疑虑，不是预订、批准或限制；后一句 “those reservations were not unreasonable” 也确认了它指的是顾虑。\n\n把 doubts 代回原句：“the committee had doubts about the new policy.” 逻辑依然成立，所以选 doubts。",
              ai:
                "把每个选项代回原句。只有 doubts 能同时保住让步从句和转折关系。",
              words: [
                { term: "reservation", pos: "n.", def: "保留意见；疑虑" },
                { term: "unreasonable", pos: "adj.", def: "不合理的；缺乏道理的" }
              ]
            },
            {
              section: "MATH",
              kindLabel: "代数",
              stem: "If 3x + 7 = 22, what is the value of x?",
              options: [
                { key: "A", text: "3" },
                { key: "B", text: "5" },
                { key: "C", text: "7" },
                { key: "D", text: "15" }
              ],
              answer: "B",
              analysis:
                "两边同时减 7：3x = 15；再除以 3：x = 5。代回检验：3(5) + 7 = 22。\n\n常见陷阱是提前停下：15 是 3x 的值，不是 x。",
              ai:
                "逆着运算走：先减 7，再除以 3；最后把结果代回原式检验。",
              words: [{ term: "isolate", pos: "v.", def: "隔离；把变量单独留在一边" }]
            },
            {
              section: "READING",
              kindLabel: "填空",
              stem:
                "The scientist's ______ approach — testing every hypothesis twice — made her conclusions unusually reliable.",
              kind: "blank",
              answer: "meticulous",
              accept: [
                "meticulous",
                "careful",
                "thorough",
                "methodical",
                "rigorous",
                "scrupulous",
                "diligent"
              ],
              analysis:
                "破折号在解释空格：每个假设都测两遍，是细致、有条理的工作。meticulous（一丝不苟的）既符合词义，也符合句子语域；careful、thorough、methodical、rigorous 也都可以接受。\n\n空格后面跟着破折号或冒号时，让后面的解释来选词。",
              ai:
                "破折号就是定义。“testing every hypothesis twice” 指向细致、有条理；meticulous 最贴合语域。",
              words: [
                { term: "meticulous", pos: "adj.", def: "一丝不苟的；极其细致的" },
                { term: "hypothesis", pos: "n.", def: "假设；待检验的解释" },
                { term: "reliable", pos: "adj.", def: "可靠的；稳定可信的" }
              ]
            }
          ]
        };

    var demoBody = demoRoot.querySelector("[data-demo-body]");
    var demoToast = demoRoot.querySelector("[data-demo-toast]");
    var VOCAB_KEY = "inteflow.website.demo.vocab";
    var savedWords = {};
    var toastTimer = null;

    try {
      var storedWords = window.localStorage.getItem(VOCAB_KEY);
      if (storedWords) {
        JSON.parse(storedWords).forEach(function (word) {
          savedWords[String(word).toLowerCase()] = true;
        });
      }
    } catch (error) {
      savedWords = {};
    }

    var demoState = {
      index: 0,
      answers: {},
      marked: {},
      submitted: false,
      view: "practice",
      reviewIndex: 0,
      leftTool: "question",
      rightTool: "analysis",
      analysisMode: "write",
      drafts: {},
      aiShown: {},
      startedAt: null,
      elapsed: 0,
      running: false
    };

    function esc(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function pad(number) {
      return number < 10 ? "0" + number : String(number);
    }

    function formatTime(seconds) {
      var safe = Math.max(0, Math.floor(seconds));
      var minutes = Math.floor(safe / 60);
      var rest = safe % 60;
      return (minutes < 10 ? "0" : "") + minutes + ":" + (rest < 10 ? "0" : "") + rest;
    }

    function normalizeAnswer(value) {
      return String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[.,!?;:'"“”‘’。，！？；：、]/g, "");
    }

    function answered(index) {
      return String(demoState.answers[index] || "").trim() !== "";
    }

    function isCorrect(index) {
      var question = DEMO.questions[index];
      var answer = demoState.answers[index] || "";
      if (!String(answer).trim()) return false;
      if (question.kind === "blank") {
        var normalized = normalizeAnswer(answer);
        return question.accept.some(function (accepted) {
          return normalizeAnswer(accepted) === normalized;
        });
      }
      return answer === question.answer;
    }

    function countCorrect() {
      var total = 0;
      DEMO.questions.forEach(function (question, index) {
        if (isCorrect(index)) total += 1;
      });
      return total;
    }

    function savedWordCount() {
      return Object.keys(savedWords).length;
    }

    function showToast(message) {
      if (!demoToast) return;
      demoToast.textContent = message;
      demoToast.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        demoToast.hidden = true;
      }, 3600);
    }

    function ensureTimer() {
      if (demoState.startedAt || demoState.submitted) return;
      demoState.startedAt = Date.now();
      demoState.running = true;
    }

    function timerText() {
      if (!demoState.startedAt) return formatTime(demoState.elapsed);
      if (!demoState.running) return formatTime(demoState.elapsed);
      return formatTime(Math.floor((Date.now() - demoState.startedAt) / 1000));
    }

    function paintTimer() {
      var el = demoRoot.querySelector("[data-demo-timer]");
      if (el) el.textContent = timerText();
    }

    function analysisText(index) {
      if (typeof demoState.drafts[index] === "string") return demoState.drafts[index];
      return DEMO.questions[index].analysis;
    }

    function toolLabel(tool) {
      return {
        question: DEMO.ui.toolQuestion,
        analysis: DEMO.ui.toolAnalysis,
        ai: DEMO.ui.toolAi,
        vocabulary: DEMO.ui.toolVocabulary
      }[tool];
    }

    function toolIcon(name) {
      var paths = {
        question:
          '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9.1 9a3 3 0 0 1 5.8 0c0 2-3 2.5-3 4"/><path d="M12 17h.01"/>',
        analysis:
          '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4M2 10h4M2 14h4M2 18h4"/><path d="M21.4 5.6a2.1 2.1 0 0 0-3-3L12 9v3h3Z"/>',
        ai:
          '<path d="m12 3-1.9 5.8L4 10.7l6.1 1.9L12 18.4l1.9-5.8L20 10.7l-6.1-1.9Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
        vocabulary:
          '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z"/>'
      };
      return (
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        paths[name] +
        "</svg>"
      );
    }

    function practicePalette() {
      var html = "";
      DEMO.questions.forEach(function (question, index) {
        var classes = ["demo-goto"];
        if (demoState.marked[index]) classes.push("is-marked");
        else if (answered(index)) classes.push("is-answered");
        if (index === demoState.index) classes.push("is-current");
        html +=
          '<button class="' +
          classes.join(" ") +
          '" type="button" data-demo-goto="' +
          index +
          '" aria-label="' +
          esc((isEnglish ? "Question " : "第 ") + (index + 1) + (isEnglish ? "" : " 题")) +
          '"' +
          (index === demoState.index ? ' aria-current="true"' : "") +
          ">" +
          (index + 1) +
          "</button>";
      });
      return html;
    }

    function reviewPalette() {
      var html = "";
      DEMO.questions.forEach(function (question, index) {
        var ok = isCorrect(index);
        var classes = ["demo-goto", ok ? "is-correct" : "is-wrong"];
        if (index === demoState.reviewIndex) classes.push("is-current");
        html +=
          '<button class="' +
          classes.join(" ") +
          '" type="button" data-demo-review="' +
          index +
          '" aria-label="Q' +
          (index + 1) +
          " · " +
          esc(ok ? DEMO.ui.correctTag : DEMO.ui.wrongTag) +
          '"' +
          (index === demoState.reviewIndex ? ' aria-current="true"' : "") +
          ">" +
          (index + 1) +
          "</button>";
      });
      return html;
    }

    function practiceOptions(question, answer) {
      var html = '<ul class="demo-options">';
      question.options.forEach(function (option) {
        var selected = answer === option.key;
        html +=
          '<li><button class="demo-option' +
          (selected ? " is-selected" : "") +
          '" type="button" data-demo-option="' +
          esc(option.key) +
          '" aria-pressed="' +
          selected +
          '"><span class="demo-key">' +
          esc(option.key) +
          '</span><span class="demo-option-text">' +
          esc(option.text) +
          "</span></button></li>";
      });
      return html + "</ul>";
    }

    function reviewOptions(question, answer) {
      var html = '<ul class="demo-options">';
      question.options.forEach(function (option) {
        var classes = ["demo-option", "is-static"];
        var flag = "";
        if (option.key === question.answer) {
          classes.push("is-correct");
          flag = DEMO.ui.correctOption;
        }
        if (option.key === answer && option.key !== question.answer) {
          classes.push("is-wrong");
          flag = DEMO.ui.yourOption;
        }
        if (option.key === answer && option.key === question.answer) {
          flag = DEMO.ui.correctOption + " · " + DEMO.ui.yourOption;
        }
        html +=
          '<li><div class="' +
          classes.join(" ") +
          '"><span class="demo-key">' +
          esc(option.key) +
          '</span><span class="demo-option-text">' +
          esc(option.text) +
          "</span>" +
          (flag ? '<span class="demo-option-flag">' + esc(flag) + "</span>" : "") +
          "</div></li>";
      });
      return html + "</ul>";
    }

    function starButton(index) {
      var marked = !!demoState.marked[index];
      return (
        '<button class="demo-star" type="button" data-demo-mark aria-pressed="' +
        marked +
        '">' +
        esc(marked ? DEMO.ui.starred : DEMO.ui.star) +
        "</button>"
      );
    }

    function renderPractice() {
      var index = demoState.index;
      var question = DEMO.questions[index];
      var answer = demoState.answers[index] || "";
      var html = '<div class="demo-app"><header class="demo-appbar">';

      html +=
        '<div class="demo-title"><strong>' +
        esc(DEMO.ui.title) +
        "</strong><small>" +
        esc(DEMO.ui.subtitle) +
        "</small></div>";
      html += '<span class="demo-pos">' + esc(DEMO.ui.questionOf(index + 1, DEMO.questions.length)) + "</span>";
      html += '<div class="demo-appbar-actions">';
      html += '<span class="demo-clock" data-demo-timer>' + esc(timerText()) + "</span>";
      html += '<button class="demo-btn" type="button" data-demo-exit>' + esc(DEMO.ui.exit) + "</button>";
      html +=
        '<button class="demo-btn demo-btn-primary" type="button" data-demo-submit>' +
        esc(DEMO.ui.submit) +
        "</button>";
      html += "</div></header>";

      html += '<main class="demo-main"><div class="demo-practice-grid' + (question.material ? "" : " is-single") + '">';
      if (question.material) {
        html +=
          '<aside class="demo-passage"><div class="demo-kicker">' +
          esc(DEMO.ui.passage) +
          "</div><p>" +
          esc(question.material) +
          "</p></aside>";
      }

      html += '<section class="demo-qcard">';
      html += '<div class="demo-qhead"><span>' +
        esc(DEMO.ui.questionHeading(index + 1, question.section, question.kindLabel)) +
        "</span>" +
        starButton(index) +
        "</div>";
      html += '<h3 class="demo-stem">' + esc(question.stem) + "</h3>";

      if (question.kind === "blank") {
        html +=
          '<label class="demo-blank-wrap"><span class="sr-only">' +
          esc(DEMO.ui.yourAnswer) +
          '</span><input class="demo-blank" type="text" data-demo-blank autocomplete="off" spellcheck="false" placeholder="' +
          esc(DEMO.ui.blankPlaceholder) +
          '" value="' +
          esc(answer) +
          '"></label>';
        html += '<p class="demo-blank-hint">' + esc(DEMO.ui.blankHint) + "</p>";
      } else {
        html += practiceOptions(question, answer);
      }

      html += "</section></div></main>";
      html += '<footer class="demo-practice-foot">';
      html +=
        '<button class="demo-btn" type="button" data-demo-prev' +
        (index === 0 ? " disabled" : "") +
        ">" +
        esc(DEMO.ui.prev) +
        "</button>";
      html += '<nav class="demo-palette" aria-label="' + esc(DEMO.ui.palette) + '">' + practicePalette() + "</nav>";
      html +=
        '<button class="demo-btn" type="button" data-demo-next' +
        (index === DEMO.questions.length - 1 ? " disabled" : "") +
        ">" +
        esc(DEMO.ui.next) +
        "</button>";
      html += "</footer></div>";

      demoBody.innerHTML = html;
      paintTimer();
    }

    function renderResult() {
      var total = DEMO.questions.length;
      var correct = countCorrect();
      var wrong = total - correct;
      var percent = Math.round((correct / total) * 100);
      var html = '<div class="demo-app"><header class="demo-appbar">';

      html +=
        '<div class="demo-title"><strong>' +
        esc(DEMO.ui.title) +
        "</strong><small>" +
        esc(DEMO.ui.resultSubtitle) +
        "</small></div>";
      html += '<div class="demo-score-inline"><strong>' + correct + "</strong><span> / " + total + "</span><small>" +
        esc(DEMO.ui.scoreDetail(percent, wrong)) +
        "</small></div>";
      html += '<div class="demo-appbar-actions">';
      html += '<button class="demo-btn" type="button" data-demo-reset>' + esc(DEMO.ui.againBtn) + "</button>";
      html +=
        '<button class="demo-btn demo-btn-primary" type="button" data-demo-view="review">' +
        esc(DEMO.ui.reviewBtn) +
        "</button>";
      html += "</div></header>";

      html += '<main class="demo-main demo-main--center"><section class="demo-summary">';
      html += '<p class="demo-kicker">' + esc(DEMO.ui.resultKicker) + "</p>";
      html += '<div class="demo-summary-top"><div class="demo-big-score"><strong>' + correct + "</strong><span>/ " + total + "</span></div>";
      html += '<div class="demo-summary-note">' + esc(DEMO.ui.resultNote(correct, total)) + "<small>" +
        esc(DEMO.ui.timeNote(formatTime(demoState.elapsed))) + "</small></div></div>";
      html += '<div class="demo-score-bar"><i style="width:' + percent + '%"></i></div>';

      html += '<ul class="demo-summary-list">';
      DEMO.questions.forEach(function (question, index) {
        var ok = isCorrect(index);
        var answer = demoState.answers[index] || "";
        var your = answer || DEMO.ui.notAnswered;
        var expected = question.kind === "blank" ? question.accept.slice(0, 3).join(" / ") : question.answer;
        html +=
          '<li class="demo-summary-row"><span>' +
          pad(index + 1) +
          '</span><div class="demo-row-main"><strong>' +
          esc(question.kindLabel) +
          "</strong><small>" +
          esc(DEMO.ui.yourAnswer) +
          ": " +
          esc(your) +
          " · " +
          esc(DEMO.ui.correctAnswer) +
          ": " +
          esc(expected) +
          '</small></div><span class="demo-row-status ' +
          (ok ? "is-correct" : "is-wrong") +
          '">' +
          (ok ? "✓" : "✕") +
          '</span><button class="demo-row-btn" type="button" data-demo-review="' +
          index +
          '">' +
          esc(DEMO.ui.review) +
          "</button></li>";
      });
      html += "</ul></section></main></div>";

      demoBody.innerHTML = html;
    }

    function renderToolHeader(side, active, other) {
      var html =
        '<div class="demo-pane-tools" role="group" aria-label="' +
        esc((isEnglish ? "Switch " : "切换") + (side === "left" ? (isEnglish ? "left" : "左侧") : (isEnglish ? "right" : "右侧")) + (isEnglish ? " pane" : "面板")) +
        '">';
      ["question", "analysis", "ai", "vocabulary"].forEach(function (tool) {
        var classes = ["demo-tool"];
        if (tool === active) classes.push("is-active");
        html +=
          '<button class="' +
          classes.join(" ") +
          '" type="button" data-demo-tool="' +
          tool +
          '" data-demo-side="' +
          side +
          '" aria-pressed="' +
          (tool === active) +
          '" title="' +
          esc(toolLabel(tool)) +
          '">' +
          toolIcon(tool) +
          "<span>" +
          esc(toolLabel(tool)) +
          "</span></button>";
      });
      return html + "</div>";
    }

    function renderQuestionTool() {
      var index = demoState.reviewIndex;
      var question = DEMO.questions[index];
      var answer = demoState.answers[index] || "";
      var ok = isCorrect(index);
      var html = '<div class="demo-pane-question"><div class="demo-qhead"><span>' +
        esc(DEMO.ui.questionHeading(index + 1, question.section, question.kindLabel)) +
        "</span>" +
        starButton(index) +
        "</div>";

      if (question.material) {
        html += '<p class="demo-pane-passage">' + esc(question.material) + "</p>";
      }
      html += '<h3 class="demo-stem">' + esc(question.stem) + "</h3>";

      if (question.kind === "blank") {
        html +=
          '<div class="demo-compare"><div><span>' +
          esc(DEMO.ui.yourAnswer) +
          "</span><strong>" +
          esc(answer || DEMO.ui.notAnswered) +
          "</strong></div><div><span>" +
          esc(DEMO.ui.accepted) +
          "</span><strong>" +
          esc(question.accept.join(" / ")) +
          "</strong></div></div>";
      } else {
        html += reviewOptions(question, answer);
      }

      html += '<span class="demo-verdict ' + (ok ? "is-correct" : "is-wrong") + '">' +
        esc(ok ? DEMO.ui.correctTag : DEMO.ui.wrongTag) +
        "</span></div>";
      return html;
    }

    function renderAnalysisTool() {
      var index = demoState.reviewIndex;
      var text = analysisText(index);
      var html = '<div class="demo-analysis">';
      html += '<div class="demo-analysis-head"><span class="demo-analysis-title">Q' +
        pad(index + 1) +
        " · " +
        esc(DEMO.ui.analysis) +
        '</span><div class="demo-tabs">';
      html +=
        '<button class="demo-tab' +
        (demoState.analysisMode === "write" ? " is-active" : "") +
        '" type="button" data-demo-analysis-mode="write">' +
        esc(DEMO.ui.write) +
        "</button>";
      html +=
        '<button class="demo-tab' +
        (demoState.analysisMode === "preview" ? " is-active" : "") +
        '" type="button" data-demo-analysis-mode="preview">' +
        esc(DEMO.ui.preview) +
        "</button>";
      html += "</div></div>";

      if (demoState.analysisMode === "preview") {
        html += '<div class="demo-editor-preview">';
        text.split("\n\n").forEach(function (paragraph) {
          html += "<p>" + esc(paragraph) + "</p>";
        });
        html += "</div>";
      } else {
        html +=
          '<textarea class="demo-editor" data-demo-analysis spellcheck="false" aria-label="' +
          esc(DEMO.ui.analysis) +
          '">' +
          esc(text) +
          "</textarea>";
      }

      html += '<p class="demo-demo-note">' + esc(DEMO.ui.analysisNote) + "</p></div>";
      return html;
    }

    function renderVocabularyTool() {
      var question = DEMO.questions[demoState.reviewIndex];
      var html = '<div class="demo-vocab">';
      html += '<div class="demo-vocab-head"><span class="mono">' + esc(DEMO.ui.wordBank) +
        '</span><span data-demo-word-count>' + esc(DEMO.ui.words(savedWordCount())) + "</span></div>";
      html += '<p class="demo-vocab-note">' + esc(DEMO.ui.vocabNote) + "</p><ul>";
      question.words.forEach(function (word) {
        var added = !!savedWords[String(word.term).toLowerCase()];
        html +=
          '<li><div class="demo-vocab-word"><strong>' +
          esc(word.term) +
          "</strong><small><em>" +
          esc(word.pos) +
          "</em>" +
          esc(word.def) +
          '</small></div><button class="demo-word-add' +
          (added ? " is-added" : "") +
          '" type="button" data-demo-word="' +
          esc(word.term) +
          '" aria-pressed="' +
          added +
          '" aria-label="' +
          esc(added ? DEMO.ui.addedWord : DEMO.ui.addWord) +
          '">' +
          (added ? "✓" : "+") +
          "</button></li>";
      });
      html += "</ul></div>";
      return html;
    }

    function renderAiTool() {
      var index = demoState.reviewIndex;
      var html = '<div class="demo-ai"><div class="demo-ai-icon">' + toolIcon("ai") + "</div>";
      html += "<h4>" + esc(DEMO.ui.aiTitle) + "</h4>";
      html += "<p>" + esc(DEMO.ui.aiTagline) + "</p>";
      if (demoState.aiShown[index]) {
        html += '<div class="demo-ai-response">' + esc(DEMO.questions[index].ai) + "</div>";
        html += '<p class="demo-ai-note">' + esc(DEMO.ui.aiNote) + "</p>";
      } else {
        html +=
          '<button class="demo-btn demo-btn-primary demo-ai-btn" type="button" data-demo-ai>' +
          esc(DEMO.ui.aiButton) +
          "</button>";
      }
      return html + "</div>";
    }

    function renderTool(tool) {
      if (tool === "analysis") return renderAnalysisTool();
      if (tool === "vocabulary") return renderVocabularyTool();
      if (tool === "ai") return renderAiTool();
      return renderQuestionTool();
    }

    function renderReview() {
      var total = DEMO.questions.length;
      var correct = countCorrect();
      var wrong = total - correct;
      var percent = Math.round((correct / total) * 100);
      var html = '<div class="demo-app demo-app--review"><header class="demo-appbar demo-appbar--review">';

      html += '<div class="demo-qnav" role="group" aria-label="' + esc(DEMO.ui.palette) + '">' + reviewPalette() + "</div>";
      html +=
        '<div class="demo-title"><strong>' +
        esc(DEMO.ui.title) +
        "</strong><small>" +
        esc(DEMO.ui.reviewSubtitle(formatTime(demoState.elapsed), total, total)) +
        "</small></div>";
      html += '<div class="demo-score-inline"><strong>' + correct + "</strong><span> / " + total + "</span><small>" +
        esc(DEMO.ui.scoreDetail(percent, wrong)) + "</small></div>";
      html += '<div class="demo-appbar-actions">';
      html += '<button class="demo-btn" type="button" data-demo-notebook>' + esc(DEMO.ui.notebook) + "</button>";
      html += '<button class="demo-btn" type="button" data-demo-export>' + esc(DEMO.ui.export) + "</button>";
      html +=
        '<button class="demo-btn demo-btn-primary" type="button" data-demo-view="result">' +
        esc(DEMO.ui.back) +
        "</button>";
      html += "</div></header>";

      html += '<div class="demo-workspace">';
      html += '<section class="demo-pane">' + renderToolHeader("left", demoState.leftTool, demoState.rightTool);
      html += '<div class="demo-pane-body">' + renderTool(demoState.leftTool) + "</div></section>";
      html += '<section class="demo-pane">' + renderToolHeader("right", demoState.rightTool, demoState.leftTool);
      html += '<div class="demo-pane-body">' + renderTool(demoState.rightTool) + "</div></section>";
      html += "</div></div>";

      demoBody.innerHTML = html;
    }

    function render() {
      if (demoState.view === "result") renderResult();
      else if (demoState.view === "review") renderReview();
      else renderPractice();
    }

    function submitDemo() {
      if (demoState.submitted) return;
      ensureTimer();
      demoState.submitted = true;
      demoState.elapsed = demoState.startedAt
        ? Math.floor((Date.now() - demoState.startedAt) / 1000)
        : 0;
      demoState.running = false;
      demoState.reviewIndex = findFirstWrong();
      demoState.view = "result";
      render();
    }

    function findFirstWrong() {
      for (var index = 0; index < DEMO.questions.length; index += 1) {
        if (!isCorrect(index)) return index;
      }
      return 0;
    }

    function resetDemo() {
      demoState.index = 0;
      demoState.answers = {};
      demoState.marked = {};
      demoState.submitted = false;
      demoState.view = "practice";
      demoState.reviewIndex = 0;
      demoState.leftTool = "question";
      demoState.rightTool = "analysis";
      demoState.analysisMode = "write";
      demoState.drafts = {};
      demoState.aiShown = {};
      demoState.startedAt = null;
      demoState.elapsed = 0;
      demoState.running = false;
      if (demoToast) demoToast.hidden = true;
      render();
    }

    function chooseTool(side, tool) {
      if (side === "left") {
        if (demoState.rightTool === tool) demoState.rightTool = demoState.leftTool;
        demoState.leftTool = tool;
      } else {
        if (demoState.leftTool === tool) demoState.leftTool = demoState.rightTool;
        demoState.rightTool = tool;
      }
      demoState.view = "review";
      render();
    }

    function toggleWord(term) {
      var key = String(term).toLowerCase();
      if (savedWords[key]) delete savedWords[key];
      else savedWords[key] = true;

      try {
        window.localStorage.setItem(VOCAB_KEY, JSON.stringify(Object.keys(savedWords)));
      } catch (error) {
        /* storage may be unavailable — the demo still works for this visit */
      }

      var added = !!savedWords[key];
      Array.prototype.forEach.call(
        demoRoot.querySelectorAll("[data-demo-word]"),
        function (button) {
          if (button.getAttribute("data-demo-word") !== term) return;
          button.classList.toggle("is-added", added);
          button.setAttribute("aria-pressed", String(added));
          button.setAttribute("aria-label", added ? DEMO.ui.addedWord : DEMO.ui.addWord);
          button.textContent = added ? "✓" : "+";
        }
      );

      var counter = demoRoot.querySelector("[data-demo-word-count]");
      if (counter) counter.textContent = DEMO.ui.words(savedWordCount());
    }

    demoRoot.addEventListener("click", function (event) {
      var target = event.target.closest ? event.target.closest("button") : null;
      if (!target || !demoRoot.contains(target)) return;

      if (target.hasAttribute("data-demo-option")) {
        ensureTimer();
        demoState.answers[demoState.index] = target.getAttribute("data-demo-option");
        render();
        return;
      }

      if (target.hasAttribute("data-demo-goto")) {
        ensureTimer();
        demoState.index = parseInt(target.getAttribute("data-demo-goto"), 10) || 0;
        render();
        return;
      }

      if (target.hasAttribute("data-demo-prev")) {
        if (demoState.index > 0) {
          ensureTimer();
          demoState.index -= 1;
          render();
        }
        return;
      }

      if (target.hasAttribute("data-demo-next")) {
        if (demoState.index < DEMO.questions.length - 1) {
          ensureTimer();
          demoState.index += 1;
          render();
        }
        return;
      }

      if (target.hasAttribute("data-demo-mark")) {
        ensureTimer();
        var markIndex = demoState.view === "review" ? demoState.reviewIndex : demoState.index;
        demoState.marked[markIndex] = !demoState.marked[markIndex];
        render();
        return;
      }

      if (target.hasAttribute("data-demo-submit")) {
        submitDemo();
        return;
      }

      if (target.hasAttribute("data-demo-review")) {
        demoState.reviewIndex = parseInt(target.getAttribute("data-demo-review"), 10) || 0;
        demoState.view = "review";
        render();
        return;
      }

      if (target.hasAttribute("data-demo-view")) {
        demoState.view = target.getAttribute("data-demo-view");
        render();
        return;
      }

      if (target.hasAttribute("data-demo-reset")) {
        resetDemo();
        return;
      }

      if (target.hasAttribute("data-demo-exit")) {
        showToast(DEMO.ui.toastExit);
        return;
      }

      if (target.hasAttribute("data-demo-notebook")) {
        showToast(DEMO.ui.toastNotebook);
        return;
      }

      if (target.hasAttribute("data-demo-export")) {
        showToast(DEMO.ui.toastExport);
        return;
      }

      if (target.hasAttribute("data-demo-tool")) {
        chooseTool(target.getAttribute("data-demo-side"), target.getAttribute("data-demo-tool"));
        return;
      }

      if (target.hasAttribute("data-demo-analysis-mode")) {
        demoState.analysisMode = target.getAttribute("data-demo-analysis-mode");
        render();
        return;
      }

      if (target.hasAttribute("data-demo-ai")) {
        demoState.aiShown[demoState.reviewIndex] = true;
        render();
        return;
      }

      if (target.hasAttribute("data-demo-word")) {
        toggleWord(target.getAttribute("data-demo-word"));
      }
    });

    demoRoot.addEventListener("input", function (event) {
      var input = event.target;
      if (!input.hasAttribute) return;

      if (input.hasAttribute("data-demo-blank")) {
        ensureTimer();
        demoState.answers[demoState.index] = input.value;
        var goto = demoRoot.querySelector('[data-demo-goto="' + demoState.index + '"]');
        if (goto) goto.classList.toggle("is-answered", input.value.trim() !== "");
        paintTimer();
        return;
      }

      if (input.hasAttribute("data-demo-analysis")) {
        demoState.drafts[demoState.reviewIndex] = input.value;
      }
    });

    demoRoot.addEventListener("keydown", function (event) {
      var tag = event.target.tagName;
      var typing = tag === "INPUT" || tag === "TEXTAREA";

      if (demoState.view !== "practice") return;

      if (event.key === "Enter" && event.target.hasAttribute && event.target.hasAttribute("data-demo-blank")) {
        event.preventDefault();
        if (demoState.index < DEMO.questions.length - 1) {
          demoState.index += 1;
          render();
        } else {
          submitDemo();
        }
        return;
      }

      if (typing) return;

      if (event.key === "ArrowLeft" && demoState.index > 0) {
        ensureTimer();
        demoState.index -= 1;
        render();
        return;
      }

      if (event.key === "ArrowRight" && demoState.index < DEMO.questions.length - 1) {
        ensureTimer();
        demoState.index += 1;
        render();
        return;
      }

      if (/^[a-dA-D]$/.test(event.key)) {
        var question = DEMO.questions[demoState.index];
        if (question.kind === "blank") return;
        var letter = event.key.toUpperCase();
        var exists = question.options.some(function (option) {
          return option.key === letter;
        });
        if (!exists) return;
        ensureTimer();
        demoState.answers[demoState.index] = letter;
        render();
      }
    });

    window.setInterval(function () {
      if (!demoState.running || !demoState.startedAt) return;
      paintTimer();
    }, 500);

    if ("IntersectionObserver" in window) {
      var demoObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) ensureTimer();
          });
        },
        { threshold: 0.35 }
      );
      demoObserver.observe(demoRoot);
    }

    render();
  }

  /* ------------------------------------------------------------------ init */

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  window.__inteflowSiteReady = true;
})();
