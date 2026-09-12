import { STROKES, poseAt, headAt, createBall, advanceBall } from "./tennis-physics.mjs";

// The racket remains still at rest; simulation frames exist only while a shot is active.
(() => {
  "use strict";
  const toy = document.querySelector(".tennis-toy");
  const hitButton = document.querySelector(".tennis-serve");
  const canvas = document.querySelector(".tennis-court");
  const pickerButton = document.querySelector(".tennis-mode");
  const picker = document.getElementById("tennis-shots");
  const quickServeButton = document.querySelector("[data-tennis-quick-serve]");
  const navHint = document.getElementById("tennis-nav-hint");
  if (!toy || !hitButton || !canvas || !pickerButton || !picker) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const racket = toy.querySelector(".tennis-racket");
  const feedback = toy.querySelector(".tennis-feedback");
  const status = toy.querySelector(".tennis-status");
  const label = toy.querySelector(".tennis-label");
  const playHint = toy.querySelector(".tennis-play-hint");
  const playHintText = playHint?.querySelector(".tennis-play-hint__text");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const modeIds = Object.keys(STROKES);
  const shotButtons = [...picker.querySelectorAll("[data-tennis-shot]")];
  const pickerArc = picker.querySelector(".tennis-shots__arc");
  const ballImage = new Image();
  ballImage.src = "assets/custom/tennis/ball.svg";
  const imageReady = ballImage.decode().then(
    () => true,
    () => false
  );
  const balls = [];
  const effects = [];
  let selected = "serve";
  let width = window.innerWidth;
  let height = window.innerHeight;
  let frame = 0;
  let previousTime = 0;
  let busyUntil = 0;
  let shotCount = 0;
  let feedbackTimer = 0;
  let pickerCloseTimer = 0;
  let pickerPinned = false;
  let pickerBounds = null;
  let generation = 0;
  let introHintTimer = 0;
  let hideHintTimer = 0;
  let hintReady = false;
  const hintKey = "homepage:tennis-hint-seen";
  let hintSeen = false;
  try {
    hintSeen = window.sessionStorage.getItem(hintKey) === "1";
  } catch {
    // The hint also works when browser storage is unavailable.
  }
  const rememberHint = () => {
    if (hintSeen) return;
    hintSeen = true;
    try {
      window.sessionStorage.setItem(hintKey, "1");
    } catch {}
  };
  const hidePlayHint = () => {
    clearTimeout(introHintTimer);
    clearTimeout(hideHintTimer);
    toy.classList.remove("is-inviting");
  };
  const showPlayHint = (text) => {
    if (!hintReady || !playHint || document.hidden || picker.matches(":popover-open")) return;
    clearTimeout(introHintTimer);
    clearTimeout(hideHintTimer);
    if (playHintText) playHintText.textContent = text;
    toy.classList.add("is-inviting");
    rememberHint();
  };
  const schedulePlayHint = () => {
    if (!hintReady || hintSeen || !playHint || document.hidden) return;
    clearTimeout(introHintTimer);
    introHintTimer = setTimeout(() => {
      if (document.hidden || picker.matches(":popover-open")) return;
      showPlayHint("Your serve?");
      hideHintTimer = setTimeout(hidePlayHint, 4500);
    }, 1200);
  };
  const dismissHints = () => {
    hidePlayHint();
    rememberHint();
    navHint?.classList.add("is-dismissed");
  };
  const inviteFromNav = () => {
    navHint?.classList.remove("is-dismissed");
    showPlayHint("Over here");
  };
  const leaveNavInvitation = () => {
    clearTimeout(hideHintTimer);
    hideHintTimer = setTimeout(() => {
      if (quickServeButton?.matches(":hover") || quickServeButton?.matches(":focus-visible") || navHint?.matches(":hover")) return;
      hidePlayHint();
    }, 200);
  };
  quickServeButton?.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") inviteFromNav();
  });
  quickServeButton?.addEventListener("pointerleave", leaveNavInvitation);
  quickServeButton?.addEventListener("focus", inviteFromNav);
  quickServeButton?.addEventListener("blur", leaveNavInvitation);
  navHint?.addEventListener("pointerenter", inviteFromNav);
  navHint?.addEventListener("pointerleave", leaveNavInvitation);

  const setMode = (id, announce = true) => {
    if (!STROKES[id]) return;
    selected = id;
    toy.dataset.stroke = id;
    toy.style.setProperty("--tennis-accent", "rgb(" + STROKES[id].color + ")");
    label.textContent = STROKES[id].short;
    hitButton.setAttribute("aria-label", "Hit " + STROKES[id].name + ". Arrow keys change stroke; Escape clears the balls.");
    picker.querySelectorAll("[data-tennis-shot]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tennisShot === id));
    });
    if (announce) status.textContent = STROKES[id].name + " selected. Press Enter to hit.";
  };
  const racketAnchor = () => {
    const box = hitButton.getBoundingClientRect();
    return {
      width: racket.clientWidth,
      height: racket.clientHeight,
      left: box.left + (box.width - racket.clientWidth) / 2,
      top: box.top,
      pivotX: 0.125,
      pivotY: 0.813,
      headX: 0.592,
      headY: 0.325,
    };
  };
  const positionPicker = () => {
    if (!picker.matches(":popover-open")) return;
    const box = toy.getBoundingClientRect();
    const halfWidth = Math.max(...shotButtons.map((button) => button.offsetWidth / 2));
    const halfHeight = Math.max(...shotButtons.map((button) => button.offsetHeight / 2));
    // Anchor the fan at the bottom-left corner, inset just enough for edge labels.
    // The racket sits inside the quarter-circle instead of beside a tilted arc.
    const centre = {
      x: Math.max(box.left, shotButtons[0].offsetWidth / 2 + 12),
      y: window.innerHeight - halfHeight - 12,
    };
    const radius = Math.min(racket.clientWidth * 2.6, window.innerWidth - centre.x - halfWidth - 12, centre.y - halfHeight - 12);
    const angleStep = 90 / Math.max(1, shotButtons.length - 1);
    const points = shotButtons.map((button, index) => {
      const angle = ((-90 + index * angleStep) * Math.PI) / 180;
      return { button, x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
    });
    const left = Math.min(...points.map(({ button, x }) => x - button.offsetWidth / 2)) - 4;
    const top = Math.min(...points.map(({ button, y }) => y - button.offsetHeight / 2)) - 4;
    const right = Math.max(...points.map(({ button, x }) => x + button.offsetWidth / 2)) + 4;
    const bottom = Math.max(...points.map(({ button, y }) => y + button.offsetHeight / 2)) + 4;
    picker.style.left = left + "px";
    picker.style.top = top + "px";
    picker.style.width = right - left + "px";
    picker.style.height = bottom - top + "px";
    picker.style.setProperty("--orbit-x", centre.x - left + "px");
    picker.style.setProperty("--orbit-y", centre.y - top + "px");
    picker.style.setProperty("--orbit-radius", radius + "px");
    points.forEach(({ button, x, y }) => {
      button.style.setProperty("--shot-x", x - left + "px");
      button.style.setProperty("--shot-y", y - top + "px");
    });
    const first = points[0],
      last = points[points.length - 1];
    pickerArc.setAttribute("viewBox", "0 0 " + (right - left) + " " + (bottom - top));
    pickerArc
      .querySelector("path")
      .setAttribute("d", `M ${first.x - left} ${first.y - top} A ${radius} ${radius} 0 0 1 ${last.x - left} ${last.y - top}`);
    pickerBounds = {
      left: Math.min(left, box.left) - 8,
      right: Math.max(right, box.right) + 8,
      top: top - 8,
      bottom: Math.max(bottom, box.bottom) + 8,
    };
  };
  const closePicker = () => {
    clearTimeout(pickerCloseTimer);
    pickerPinned = false;
    pickerBounds = null;
    if (picker.matches(":popover-open")) picker.hidePopover();
  };
  const openPicker = (focus = false) => {
    dismissHints();
    clearTimeout(pickerCloseTimer);
    if (!picker.matches(":popover-open")) picker.showPopover();
    positionPicker();
    if (focus) picker.querySelector('[data-tennis-shot="' + selected + '"]').focus({ preventScroll: true });
  };
  const schedulePickerClose = () => {
    clearTimeout(pickerCloseTimer);
    pickerCloseTimer = setTimeout(() => {
      if (!pickerPinned && !toy.matches(":hover") && !picker.matches(":hover") && !picker.contains(document.activeElement)) closePicker();
    }, 500);
  };
  pickerButton.addEventListener("click", (event) => {
    event.preventDefault();
    if (picker.matches(":popover-open") && pickerPinned) closePicker();
    else {
      pickerPinned = event.pointerType === "touch" || event.detail === 0;
      openPicker(event.detail === 0);
    }
  });
  toy.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse" && !document.querySelector(":popover-open")) openPicker();
  });
  toy.addEventListener("pointerleave", schedulePickerClose);
  // Preserve the fan while crossing its empty space; no invisible surface blocks the racket.
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !pickerBounds || pickerPinned) return;
    const { left, right, top, bottom } = pickerBounds;
    if (event.clientX >= left && event.clientX <= right && event.clientY >= top && event.clientY <= bottom) clearTimeout(pickerCloseTimer);
    else schedulePickerClose();
  });
  picker.addEventListener("pointerenter", () => clearTimeout(pickerCloseTimer));
  picker.addEventListener("pointerleave", schedulePickerClose);
  picker.addEventListener("focusout", schedulePickerClose);
  picker.addEventListener("toggle", () => {
    const open = picker.matches(":popover-open");
    if (!open) {
      pickerPinned = false;
      pickerBounds = null;
    }
    pickerButton.setAttribute("aria-expanded", String(open));
    toy.classList.toggle("is-selecting", open);
  });
  picker.querySelectorAll("[data-tennis-shot]").forEach((button) => {
    button.style.setProperty("--shot-accent", "rgb(" + STROKES[button.dataset.tennisShot].color + ")");
  });
  picker.querySelectorAll("[data-tennis-shot]").forEach((button) =>
    button.addEventListener("click", (event) => {
      setMode(button.dataset.tennisShot, false);
      clearTimeout(pickerCloseTimer);
      pickerPinned = event.pointerType === "touch" || event.detail === 0;
      // Mouse focus should not keep the fan open after leaving; keyboard focus stays on the shot.
      if (!pickerPinned) hitButton.focus({ preventScroll: true });
      hitShot(true);
    })
  );
  const changeWithKeys = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let next = null;
    if (/^[1-5]$/.test(event.key)) next = modeIds[Number(event.key) - 1];
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = modeIds[(modeIds.indexOf(selected) + 1) % modeIds.length];
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = modeIds[(modeIds.indexOf(selected) + modeIds.length - 1) % modeIds.length];
    if (next) {
      event.preventDefault();
      setMode(next);
      if (picker.contains(event.target)) picker.querySelector('[data-tennis-shot="' + next + '"]').focus({ preventScroll: true });
    }
  };
  toy.addEventListener("keydown", changeWithKeys);
  picker.addEventListener("keydown", changeWithKeys);
  hitButton.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    setMode(modeIds[(modeIds.indexOf(selected) + 1) % modeIds.length]);
  });
  setMode(selected, false);

  const resizeCanvas = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2000000 / (width * height)));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const clearCourt = () => {
    generation++;
    cancelAnimationFrame(frame);
    clearTimeout(feedbackTimer);
    frame = 0;
    previousTime = 0;
    busyUntil = 0;
    balls.length = 0;
    effects.length = 0;
    context.clearRect(0, 0, width, height);
    canvas.hidden = true;
    canvas.width = canvas.height = 1;
    toy.classList.remove("has-feedback");
    racket.getAnimations().forEach((animation) => animation.cancel());
  };
  const addEffect = (effect) => {
    if (effects.length >= 12) effects.shift();
    effects.push(effect);
  };
  const strokePath = (points, color, opacity, thickness, offset = 0) => {
    if (points.length < 2) return;
    context.beginPath();
    points.forEach((point, index) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
      const x = point.x - ((next.y - previous.y) / length) * offset;
      const y = point.y + ((next.x - previous.x) / length) * offset;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = "rgba(" + color + "," + opacity + ")";
    context.lineWidth = thickness;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  };
  const renderBall = (ball) => {
    const stroke = STROKES[ball.mode];
    const alpha = ball.opacity;
    const trail = ball.trail;
    context.save();
    if (ball.mode === "slice") context.setLineDash([5, 5]);
    if (ball.mode === "backhand") {
      strokePath(trail, stroke.color, alpha * 0.24, 1.8, 3);
      strokePath(trail, stroke.color, alpha * 0.14, 1.8, -3);
    } else {
      for (let i = 1; i < trail.length; i++) {
        strokePath([trail[i - 1], trail[i]], stroke.color, ((alpha * i) / trail.length) * 0.3, ball.mode === "flat" ? 2.8 : 2);
      }
    }
    if (ball.mode === "flat" && trail.length > 4) {
      strokePath(trail.slice(-7), stroke.color, alpha * 0.15, 1, 4);
      strokePath(trail.slice(-7), stroke.color, alpha * 0.15, 1, -4);
    }
    context.restore();

    const elevation = Math.max(0, height - ball.y);
    context.save();
    context.globalAlpha = alpha * Math.max(0.015, 0.12 - (elevation / height) * 0.1);
    context.fillStyle = "#26332c";
    context.beginPath();
    context.ellipse(ball.x, height - 6, ball.radius * 1.1, 2.4, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.globalAlpha = alpha;
    context.translate(ball.x, ball.y);
    context.rotate(ball.spin);
    context.shadowColor = "rgba(43,58,21,.13)";
    context.shadowBlur = 3;
    context.shadowOffsetY = 2;
    context.drawImage(ballImage, -ball.radius, -ball.radius, ball.radius * 2, ball.radius * 2);
    context.shadowBlur = 0;
    if (ball.phase === "flight" && (ball.mode === "topspin" || ball.mode === "slice")) {
      context.strokeStyle = "rgba(" + stroke.color + ",.6)";
      context.lineWidth = 1.3;
      context.beginPath();
      context.arc(0, 0, ball.radius + 3, 0, Math.PI * 0.55);
      context.stroke();
      context.beginPath();
      context.arc(0, 0, ball.radius + 3, Math.PI, Math.PI * 1.55);
      context.stroke();
    }
    context.restore();
  };
  const renderEffect = (effect, now) => {
    const age = (now - effect.started) / 1000;
    const stroke = STROKES[effect.mode];
    if (effect.kind === "swing") {
      const progress = Math.min(1, age / (stroke.duration / 1000));
      const visible = Math.max(2, Math.floor(progress * effect.points.length));
      const recent = effect.points.slice(Math.max(0, visible - 17), visible);
      const alpha = Math.max(0, 1 - Math.max(0, age - stroke.duration / 1000) / 0.22);
      if (effect.mode === "backhand") {
        strokePath(recent, stroke.color, alpha * 0.28, 3, 4);
        strokePath(recent, stroke.color, alpha * 0.16, 3, -4);
      } else {
        strokePath(recent, stroke.color, alpha * 0.13, effect.mode === "slice" ? 12 : 8);
        strokePath(recent, stroke.color, alpha * 0.4, 1.7);
      }
      return age > stroke.duration / 1000 + 0.22;
    }
    const progress = age / 0.3;
    if (progress > 1) return true;
    context.save();
    context.strokeStyle = "rgba(" + stroke.color + "," + (1 - progress) * 0.5 + ")";
    context.lineWidth = 1.4;
    context.beginPath();
    if (effect.kind === "bounce" && effect.mode === "slice") context.ellipse(effect.x, effect.y, 8 + progress * 22, 2, 0, 0, Math.PI * 2);
    else context.arc(effect.x, effect.y, 4 + progress * 17, 0, Math.PI * 2);
    context.stroke();
    if (effect.kind === "hit" && (effect.mode === "serve" || effect.mode === "flat")) {
      for (let ray = 0; ray < 4; ray++) {
        const angle = (ray * Math.PI) / 2 + 0.35;
        const a = 10 + progress * 8,
          b = a + 9 * (1 - progress);
        context.beginPath();
        context.moveTo(effect.x + Math.cos(angle) * a, effect.y + Math.sin(angle) * a);
        context.lineTo(effect.x + Math.cos(angle) * b, effect.y + Math.sin(angle) * b);
        context.stroke();
      }
    }
    context.restore();
    return false;
  };
  const drawFrame = (now) => {
    const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.032) : 1 / 60;
    previousTime = now;
    context.clearRect(0, 0, width, height);
    for (let i = effects.length - 1; i >= 0; i--) if (renderEffect(effects[i], now)) effects.splice(i, 1);
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      if (ball.phase !== "flight") {
        const progress = Math.min(1, (now - ball.started) / ball.delay);
        const lift = ball.phase === "toss" ? 2 * progress - progress * progress : progress;
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 5) ball.trail.shift();
        ball.x = ball.from.x + (ball.to.x - ball.from.x) * progress;
        ball.y = ball.from.y + (ball.to.y - ball.from.y) * lift;
        ball.spin += dt * 3;
        if (progress >= 1) {
          const mode = ball.mode,
            point = ball.to;
          Object.assign(ball, createBall(mode, point, { width, height }));
          addEffect({ kind: "hit", mode, ...point, started: now });
        }
      } else {
        const collisions = advanceBall(ball, dt, { width, height });
        collisions.forEach((collision) => addEffect({ ...collision, mode: ball.mode, started: now }));
      }
      if (ball.opacity <= 0) {
        balls.splice(i, 1);
        continue;
      }
      renderBall(ball);
    }
    if (balls.length || effects.length) frame = requestAnimationFrame(drawFrame);
    else {
      frame = 0;
      previousTime = 0;
      canvas.hidden = true;
      canvas.width = canvas.height = 1;
    }
  };

  const hitShot = async (interrupt = false) => {
    dismissHints();
    const now = performance.now();
    // Choosing a stroke is an action: never discard it during the previous wind-up.
    if (!interrupt && now < busyUntil) return;
    const mode = selected;
    const stroke = STROKES[mode];
    busyUntil = now + stroke.duration * stroke.contact + 65;
    const currentGeneration = generation;
    if (!(await imageReady) || currentGeneration !== generation || document.hidden) return;
    shotCount++;
    feedback.textContent = stroke.name + "!";
    status.textContent = stroke.name + ", shot " + shotCount + ". Press Escape to clear.";
    toy.classList.add("has-feedback");
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => toy.classList.remove("has-feedback"), 550);
    if (reducedMotion.matches) return;

    racket.getAnimations().forEach((animation) => animation.cancel());
    for (let i = balls.length - 1; i >= 0; i--) if (balls[i].phase !== "flight") balls.splice(i, 1);
    if (!frame) resizeCanvas();
    const anchor = racketAnchor();
    const scale = anchor.height / 170;
    const transform = (value) =>
      "translate(" + value.x * scale + "px," + value.y * scale + "px) rotate(" + value.angle + "deg) scaleX(" + value.face + ")";
    const started = performance.now();
    racket.animate(
      stroke.poses.map((value) => ({ transform: transform(value), offset: value.t, easing: "ease-in-out" })),
      {
        duration: stroke.duration,
        easing: "linear",
      }
    );
    const contact = headAt(poseAt(stroke, stroke.contact), anchor);
    contact.x = Math.max(22, Math.min(width - 22, contact.x));
    contact.y = Math.max(22, Math.min(height - 22, contact.y));
    const restingHead = headAt(stroke.poses[0], anchor);
    const from =
      mode === "serve"
        ? { x: restingHead.x - 10, y: restingHead.y + 32 * scale }
        : { x: Math.max(18, contact.x - 36 * scale), y: contact.y - 12 * scale };
    if (balls.length >= 5) balls.shift();
    balls.push({
      ...createBall(mode, contact, { width, height }),
      x: from.x,
      y: from.y,
      phase: mode === "serve" ? "toss" : "feed",
      from,
      to: contact,
      started,
      delay: stroke.duration * stroke.contact,
    });
    const points = Array.from({ length: 55 }, (_, i) => headAt(poseAt(stroke, i / 54), anchor));
    addEffect({ kind: "swing", mode, points, started });
    canvas.hidden = false;
    if (!frame) frame = requestAnimationFrame(drawFrame);
  };
  hitButton.addEventListener("click", (event) => {
    event.preventDefault();
    hitShot();
  });
  quickServeButton?.addEventListener("click", () => {
    closePicker();
    setMode("serve", false);
    return hitShot(true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      dismissHints();
      closePicker();
      clearCourt();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hidePlayHint();
      navHint?.classList.add("is-dismissed");
      closePicker();
      clearCourt();
    } else {
      schedulePlayHint();
    }
  });
  window.addEventListener("resize", () => {
    clearCourt();
    positionPicker();
  });
  reducedMotion.addEventListener("change", clearCourt);
  window.addEventListener("pagehide", () => {
    hidePlayHint();
    clearCourt();
  });
  imageReady.then((ready) => {
    hintReady = ready;
    schedulePlayHint();
  });
})();
