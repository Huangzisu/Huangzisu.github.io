/* =====================================================================
   Zisu Huang — homepage interactions
   ===================================================================== */
(function () {
  "use strict";

  const doc = document;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- current year ---- */
  const yearEl = doc.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- sticky nav state + active link ---- */
  const nav = doc.getElementById("nav");
  const navLinks = Array.from(doc.querySelectorAll(".nav__links a"));
  const sections = navLinks.map((a) => doc.querySelector(a.getAttribute("href"))).filter(Boolean);

  const onScroll = () => {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 40);

    let current = "";
    const mid = window.scrollY + window.innerHeight * 0.35;
    sections.forEach((sec) => {
      if (sec.offsetTop <= mid) current = "#" + sec.id;
    });
    navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === current));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- live GitHub star counts (cached for instant repeat loads) ---- */
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
  starEls.forEach((el) => {
    const repo = el.getAttribute("data-repo");
    const cacheKey = "ghstar:" + repo;
    let hadCache = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached !== null && cached !== "") {
        renderStar(el, Number(cached), false);
        hadCache = true;
      }
    } catch (e) {}
    fetch("https://api.github.com/repos/" + repo)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (typeof data.stargazers_count !== "number") return;
        try {
          localStorage.setItem(cacheKey, String(data.stargazers_count));
        } catch (e) {}
        renderStar(el, data.stargazers_count, !hadCache);
      })
      .catch(() => {});
  });

  /* ---- portrait flip (manga <-> real photo) ---- */
  const portrait = doc.querySelector(".portrait");
  if (portrait) {
    portrait.addEventListener("click", () => {
      const flipped = portrait.classList.toggle("is-flipped");
      portrait.setAttribute("aria-pressed", flipped ? "true" : "false");
    });
  }
})();
