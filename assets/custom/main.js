/* =====================================================================
   Zisu Huang — homepage interactions
   ===================================================================== */
(function () {
  "use strict";

  const doc = document;

  /* ---- current year ---- */
  const yearEl = doc.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- sticky nav state + active link ---- */
  const nav = doc.getElementById("nav");
  const navMenu = doc.querySelector(".nav__links");
  const navItems = Array.from(doc.querySelectorAll(".nav__links > a, .nav__links > button:not([data-nav-action])"));
  const navLinks = Array.from(doc.querySelectorAll(".nav__links a"));
  const sections = navLinks.map((a) => doc.querySelector(a.getAttribute("href"))).filter(Boolean);
  const navHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  let hoveredNavItem = null;
  let indicatorTarget = null;

  const positionNavIndicator = (force = false) => {
    if (!navMenu) return;
    const focused = navItems.find((item) => item === doc.activeElement && item.matches(":focus-visible"));
    const expanded = navItems.find((item) => item.getAttribute("aria-expanded") === "true");
    const target = hoveredNavItem || focused || expanded || navMenu.querySelector("a.is-active") || navItems[0];
    if (!target || (!force && target === indicatorTarget)) return;
    indicatorTarget = target;
    navMenu.style.setProperty("--nav-indicator-x", target.offsetLeft + "px");
    navMenu.style.setProperty("--nav-indicator-y", target.offsetTop + target.offsetHeight - 4 + "px");
    navMenu.style.setProperty("--nav-indicator-width", target.offsetWidth + "px");
    navMenu.classList.add("has-indicator");
  };

  const onScroll = () => {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 40);

    let current = "";
    let currentTop = -Infinity;
    const mid = window.scrollY + window.innerHeight * 0.35;
    sections.forEach((sec) => {
      const top = sec.getBoundingClientRect().top + window.scrollY;
      const id = "#" + sec.id;
      if (top <= mid && (top > currentTop || (top === currentTop && window.location.hash === id))) {
        current = id;
        currentTop = top;
      }
    });
    navLinks.forEach((a) => {
      const active = a.getAttribute("href") === current;
      a.classList.toggle("is-active", active);
      if (active) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    positionNavIndicator();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  navItems.forEach((item) => {
    item.addEventListener("pointerenter", (event) => {
      if (!navHover.matches || event.pointerType === "touch") return;
      hoveredNavItem = item;
      positionNavIndicator();
    });
  });
  if (navMenu) {
    navMenu.querySelectorAll("[data-nav-action]").forEach((action) => {
      action.addEventListener("pointerenter", () => {
        hoveredNavItem = null;
        positionNavIndicator();
      });
    });
    navMenu.addEventListener("pointerleave", () => {
      hoveredNavItem = null;
      positionNavIndicator();
    });
    navMenu.addEventListener("focusin", () => {
      if (doc.activeElement?.matches(":focus-visible")) hoveredNavItem = null;
      positionNavIndicator();
    });
    navMenu.addEventListener("focusout", () => queueMicrotask(() => positionNavIndicator()));
    // Re-measure only on layout/font changes, not on every animation frame.
    if ("ResizeObserver" in window) {
      const navObserver = new ResizeObserver(() => positionNavIndicator(true));
      navObserver.observe(navMenu);
      navItems.forEach((item) => navObserver.observe(item));
    }
    if (doc.fonts) doc.fonts.ready.then(() => positionNavIndicator(true));
    window.addEventListener("resize", () => {
      onScroll();
      positionNavIndicator(true);
    });
  }

  /* ---- floating News messenger and light-dismiss card ---- */
  const newsPanel = doc.getElementById("news");
  const newsFloat = doc.querySelector(".news-float");
  const newsOpeners = Array.from(doc.querySelectorAll("[data-news-open]"));
  if (newsPanel && newsFloat && typeof newsPanel.showPopover === "function") {
    const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isNewsOpen = () => newsPanel.matches(":popover-open");
    let newsOpener = null;
    let drag = null;
    let suppressClick = false;
    let hasMoved = false;
    const clamp = (value, low, high) => Math.max(low, Math.min(value, Math.max(low, high)));
    const positionNews = () => {
      if (!isNewsOpen()) return;
      const anchor = newsFloat.getBoundingClientRect();
      const width = newsPanel.offsetWidth;
      const height = newsPanel.offsetHeight;
      let left = anchor.right - width;
      let top = anchor.top - height - 14;
      let origin = "bottom right";
      if (top < 12) {
        if (anchor.bottom + height + 14 <= window.innerHeight - 12) {
          top = anchor.bottom + 14;
          origin = "top right";
        } else {
          top = anchor.top - height / 2;
          if (anchor.left - width - 14 >= 12) left = anchor.left - width - 14;
          else if (anchor.right + width + 14 <= window.innerWidth - 12) left = anchor.right + 14;
          origin = "center";
        }
      }
      newsPanel.style.setProperty("--news-left", clamp(left, 12, window.innerWidth - width - 12) + "px");
      newsPanel.style.setProperty("--news-top", clamp(top, 12, window.innerHeight - height - 12) + "px");
      newsPanel.style.setProperty("--news-origin", origin);
    };
    const syncNews = () => {
      const open = isNewsOpen();
      newsOpeners.forEach((opener) => opener.setAttribute("aria-expanded", String(open)));
      positionNavIndicator();
    };
    const openNews = (opener) => {
      newsOpener = opener || doc.activeElement;
      newsPanel.showPopover();
      positionNews();
      syncNews();
    };
    const closeNews = (restoreFocus = false) => {
      if (isNewsOpen()) newsPanel.hidePopover();
      syncNews();
      if (restoreFocus && newsOpener?.isConnected) newsOpener.focus({ preventScroll: true });
    };
    newsOpeners.forEach((opener) =>
      opener.addEventListener("click", (event) => {
        event.preventDefault();
        if (opener === newsFloat && suppressClick) {
          event.preventDefault();
          return;
        }
        if (isNewsOpen()) closeNews(true);
        else openNews(opener);
      })
    );
    newsPanel.querySelector("[data-news-close]").addEventListener("click", () => closeNews(true));
    newsPanel.addEventListener("toggle", syncNews);
    newsPanel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNews(true);
      }
    });
    newsFloat.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      const box = newsFloat.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: box.left, top: box.top, moved: false };
      suppressClick = false;
      newsFloat.setPointerCapture(event.pointerId);
    });
    newsFloat.addEventListener("pointermove", (event) => {
      if (drag && event.pointerId === drag.id) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        hasMoved = true;
        newsFloat.classList.add("is-dragging");
        newsFloat.style.right = "auto";
        newsFloat.style.bottom = "auto";
        newsFloat.style.left = clamp(drag.left + dx, 8, window.innerWidth - newsFloat.offsetWidth - 8) + "px";
        newsFloat.style.top = clamp(drag.top + dy, 8, window.innerHeight - newsFloat.offsetHeight - 8) + "px";
        positionNews();
      } else if (event.pointerType === "mouse" && !reducedMotion()) {
        const box = newsFloat.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        newsFloat.style.setProperty("--plane-x", x * 6 + "px");
        newsFloat.style.setProperty("--plane-y", y * 4 + "px");
        newsFloat.style.setProperty("--plane-tilt", -8 + x * 22 + "deg");
      }
    });
    const finishDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      suppressClick = drag.moved;
      drag = null;
      newsFloat.classList.remove("is-dragging");
      if (newsFloat.hasPointerCapture(event.pointerId)) newsFloat.releasePointerCapture(event.pointerId);
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    };
    newsFloat.addEventListener("pointerup", finishDrag);
    newsFloat.addEventListener("pointercancel", finishDrag);
    newsFloat.addEventListener("pointerleave", () => {
      if (drag) return;
      newsFloat.style.removeProperty("--plane-x");
      newsFloat.style.removeProperty("--plane-y");
      newsFloat.style.removeProperty("--plane-tilt");
    });
    window.addEventListener("resize", () => {
      if (hasMoved) {
        const box = newsFloat.getBoundingClientRect();
        newsFloat.style.left = clamp(box.left, 8, window.innerWidth - newsFloat.offsetWidth - 8) + "px";
        newsFloat.style.top = clamp(box.top, 8, window.innerHeight - newsFloat.offsetHeight - 8) + "px";
      }
      positionNews();
    });
    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#news" && !isNewsOpen()) openNews(newsFloat);
    });
    if (window.location.hash === "#news") openNews(newsFloat);
  }

  /* ---- load the off-screen visitor map only when it is near the viewport ---- */
  const mapLoader = doc.querySelector('script[type="application/x-lazy-script"][data-src]');
  if (mapLoader) {
    const loadMap = () => {
      const script = doc.createElement("script");
      script.src = mapLoader.dataset.src;
      script.async = true;
      mapLoader.replaceWith(script);
    };
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            loadMap();
          }
        },
        { rootMargin: "240px" }
      );
      observer.observe(mapLoader.parentElement);
    } else window.addEventListener("load", loadMap, { once: true });
  }

  /* ---- refresh star counts on first News opening; reuse fresh cached counts ---- */
  const starEls = Array.from(doc.querySelectorAll(".gh-star[data-repo]"));
  const fmtStars = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n));
  const STAR_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>';
  const renderStar = (el, count, animate) => {
    el.innerHTML = STAR_SVG + fmtStars(count);
    el.setAttribute("title", count.toLocaleString() + " GitHub stars");
    el.classList.add("is-loaded");
    if (animate) {
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-visible")));
    } else {
      el.classList.add("is-visible");
    }
  };
  let starsLoaded = false;
  const loadStars = () => {
    if (starsLoaded) return;
    starsLoaded = true;
    starEls.forEach((el) => {
      const repo = el.getAttribute("data-repo");
      const cacheKey = "ghstar:" + repo;
      let hadCache = false;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached !== null && cached !== "") {
          renderStar(el, Number(cached), false);
          hadCache = true;
          const updated = Number(localStorage.getItem(cacheKey + ":updated"));
          if (Date.now() - updated < 30 * 60 * 1000) return;
        }
      } catch (e) {}
      fetch("https://api.github.com/repos/" + repo)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          if (typeof data.stargazers_count !== "number") return;
          try {
            localStorage.setItem(cacheKey, String(data.stargazers_count));
            localStorage.setItem(cacheKey + ":updated", String(Date.now()));
          } catch (e) {}
          renderStar(el, data.stargazers_count, !hadCache);
        })
        .catch(() => {});
    });
  };
  if (newsPanel) {
    newsPanel.addEventListener("toggle", () => {
      if (newsPanel.matches(":popover-open")) loadStars();
    });
    if (newsPanel.matches(":popover-open")) loadStars();
  }

  /* ---- portrait flip (manga <-> real photo) ---- */
  const portrait = doc.querySelector(".portrait");
  if (portrait) {
    portrait.addEventListener("click", () => {
      const flipped = portrait.classList.toggle("is-flipped");
      portrait.setAttribute("aria-pressed", flipped ? "true" : "false");
      portrait.setAttribute("aria-label", flipped ? "Show illustrated portrait of Zisu Huang" : "Show photo of Zisu Huang");
      portrait.querySelector(".portrait__face--front").setAttribute("aria-hidden", String(flipped));
      portrait.querySelector(".portrait__face--back").setAttribute("aria-hidden", String(!flipped));
    });
  }
})();
