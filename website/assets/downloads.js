/*
 * InteFlow — resolve the latest desktop release assets.
 * ---------------------------------------------------------------------------
 * The HTML must keep working without this file or without a release: every
 * platform card starts with a valid fallback (the downloads page or the GitHub
 * Releases page). When a release exists, this script upgrades those cards to
 * direct asset URLs and shows the detected version.
 *
 * Plain JavaScript, no dependencies. GitHub's API allows browser CORS and this
 * request is anonymous; the site never sends anything about the visitor.
 *
 * "Latest" is resolved at runtime, never baked into the HTML, so publishing a
 * new GitHub Release is enough — no site redeploy. Requests bypass the browser
 * cache and carry a cache-busting query so a visitor who opens the page right
 * after a release cannot be served the previous version. The lookup also runs
 * again when the tab becomes visible and every 15 minutes, so long-lived tabs
 * pick up a new release without a reload.
 */
(function () {
  "use strict";

  var REPO = "JasonSun2009CN/InteFlow";
  var LATEST = "https://api.github.com/repos/" + REPO + "/releases/latest";
  var LIST = "https://api.github.com/repos/" + REPO + "/releases?per_page=5";
  var REFRESH_MS = 15 * 60 * 1000;

  var isEnglish = /^en/i.test(document.documentElement.lang || "");
  var cards = Array.prototype.slice.call(
    document.querySelectorAll("[data-download-platform]")
  );

  if (!cards.length) return;
  if (!window.fetch) return;

  var MESSAGES = isEnglish
    ? {
        emptyTitle: "No desktop build yet",
        emptyDetail:
          "Desktop builds are uploaded to GitHub Releases when a new version is published. Until then, run from source; once a build exists, these buttons update to direct downloads.",
        readyTitle: function (version, count) {
          return "Latest version " + version + (count > 1 ? " · " + count + " builds" : "");
        },
        readyDetail:
          "Choose your platform below. The first launch of an unsigned build needs one extra step — see the install notes.",
        noMatchTitle: function (version) {
          return "Latest version " + version + " has no matching build";
        },
        noMatchDetail:
          "Open GitHub Releases to see every uploaded file, or run from source.",
        errorTitle: "Could not check the latest version",
        errorDetail:
          "Open GitHub Releases for the latest installers, or run from source.",
        download: "Download"
      }
    : {
        emptyTitle: "还没有桌面安装包",
        emptyDetail:
          "桌面构建会在发布新版本时自动上传到 GitHub Releases。现在可以先从源码运行；安装包发布后，这里的按钮会自动变成直接下载。",
        readyTitle: function (version, count) {
          return "最新版本 " + version + (count > 1 ? " · " + count + " 个安装包" : "");
        },
        readyDetail:
          "选择你的平台直接下载。未签名版本首次打开需要多一步，见下方安装说明。",
        noMatchTitle: function (version) {
          return "最新版本 " + version + " 暂无匹配安装包";
        },
        noMatchDetail: "请前往 GitHub Releases 查看全部文件，或从源码运行。",
        errorTitle: "暂时无法读取版本信息",
        errorDetail: "请前往 GitHub Releases 查看最新安装包，或从源码运行。",
        download: "下载"
      };

  function formatSize(bytes) {
    if (!bytes || bytes < 0) return "";
    var mb = bytes / (1024 * 1024);
    if (mb >= 1) return Math.round(mb) + " MB";
    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function matchAsset(assets, platform) {
    for (var index = 0; index < assets.length; index += 1) {
      var asset = assets[index] || {};
      var name = String(asset.name || "").toLowerCase();
      if (platform === "mac-arm64") {
        if (/\.dmg$/.test(name) && /(arm64|aarch64)/.test(name)) return asset;
      } else if (platform === "mac-x64") {
        if (/\.dmg$/.test(name) && /(x64|x86_64|amd64)/.test(name)) return asset;
      } else if (platform === "win-x64") {
        if (/\.exe$/.test(name) && /(x64|x86_64|amd64)/.test(name)) return asset;
      }
    }
    return null;
  }

  function setStatus(state, title, detail) {
    var box = document.querySelector("[data-release-status]");
    if (!box) return;
    box.setAttribute("data-state", state);
    var titleEl = box.querySelector("[data-release-title]");
    var detailEl = box.querySelector("[data-release-detail]");
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.textContent = detail;
  }

  function markReady(card, asset, version) {
    card.href = asset.browser_download_url;
    card.setAttribute("data-download-ready", "true");
    card.removeAttribute("aria-disabled");
    if (asset.size) card.setAttribute("data-size", formatSize(asset.size));

    var suffix = (version ? " " + version : "") + (asset.size ? " · " + formatSize(asset.size) : "");
    card.title = MESSAGES.download + suffix;

    var label = card.querySelector("[data-download-label]");
    if (label && !card.hasAttribute("data-download-static-label")) {
      label.textContent = MESSAGES.download + (asset.size ? " · " + formatSize(asset.size) : "");
    }
  }

  /** Git api call that never reuses a browser-cached response. */
  function request(url) {
    return fetch(
      url + (url.indexOf("?") === -1 ? "?" : "&") + "t=" + Date.now(),
      {
        headers: { Accept: "application/vnd.github+json" },
        credentials: "omit",
        cache: "no-store"
      }
    ).then(function (response) {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    });
  }

  /**
   * `/releases/latest` is the intended endpoint. If it is empty or briefly
   * unavailable (for example while a release is still being published), fall
   * back to the newest entry in the release list; prefer a stable release over
   * a prerelease.
   */
  function loadRelease() {
    return request(LATEST)
      .catch(function () {
        return null;
      })
      .then(function (release) {
        if (release && release.tag_name) return release;
        return request(LIST).then(function (list) {
          if (!Array.isArray(list)) return null;
          var prerelease = null;
          for (var index = 0; index < list.length; index += 1) {
            var item = list[index];
            if (!item || item.draft) continue;
            if (!item.prerelease) return item;
            if (!prerelease) prerelease = item;
          }
          return prerelease;
        });
      });
  }

  var lastRelease = null;

  function apply(release) {
    if (!release || !release.tag_name) {
      setStatus("empty", MESSAGES.emptyTitle, MESSAGES.emptyDetail);
      return;
    }

    lastRelease = release;
    var assets = Array.isArray(release.assets) ? release.assets : [];
    var found = 0;
    var seen = {};

    cards.forEach(function (card) {
      var platform = card.getAttribute("data-download-platform");
      var asset = matchAsset(assets, platform);
      if (!asset) return;
      if (!seen[platform]) {
        seen[platform] = true;
        found += 1;
      }
      markReady(card, asset, release.tag_name);
    });

    var box = document.querySelector("[data-release-status]");
    if (box) box.setAttribute("data-release-version", release.tag_name);

    if (found) {
      setStatus(
        "ready",
        MESSAGES.readyTitle(release.tag_name, found),
        MESSAGES.readyDetail
      );
    } else {
      setStatus(
        "empty",
        MESSAGES.noMatchTitle(release.tag_name),
        MESSAGES.noMatchDetail
      );
    }
  }

  function refresh() {
    loadRelease().then(apply).catch(function () {
      // Keep a version that was already resolved; only show the error state
      // when there is nothing on screen yet.
      if (!lastRelease) {
        setStatus("error", MESSAGES.errorTitle, MESSAGES.errorDetail);
      }
    });
  }

  refresh();

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });
  window.setInterval(refresh, REFRESH_MS);
})();
