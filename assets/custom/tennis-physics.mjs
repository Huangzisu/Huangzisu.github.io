// Viewport-scale toy physics; the five strokes have distinct launch, spin,
// aerodynamic and bounce behavior. No dependency on rendering or the DOM.
const pose = (t, x, y, angle, face = 1) => ({ t, x, y, angle, face });
const rest = () => pose(0, 0, 0, 18);
const finish = () => pose(1, 0, 0, 18);

export const STROKES = {
  serve: {
    name: "Serve",
    short: "Serve",
    color: "173, 129, 48",
    duration: 780,
    contact: 0.56,
    speed: 0.88,
    minSpeed: 520,
    maxSpeed: 1280,
    gravity: 1080,
    lift: 0,
    down: 90,
    magnus: 0,
    drag: 0.025,
    spin: 4,
    restitution: 0.72,
    kick: 0.92,
    trail: 19,
    poses: [rest(), pose(0.22, 18, 6, -32), pose(0.4, 16, -74, -16), pose(0.56, 28, -84, 8), pose(0.78, 38, -24, 76), finish()],
  },
  topspin: {
    name: "Topspin",
    short: "Topspin",
    color: "71, 133, 80",
    duration: 560,
    contact: 0.51,
    speed: 0.54,
    minSpeed: 315,
    maxSpeed: 840,
    gravity: 980,
    lift: 0.27,
    magnus: 0.36,
    drag: 0.05,
    spin: 26,
    restitution: 0.86,
    kick: 1.035,
    trail: 15,
    poses: [rest(), pose(0.24, -5, 26, -18), pose(0.51, 24, -14, 35), pose(0.77, 35, -43, 82), finish()],
  },
  flat: {
    name: "Flat drive",
    short: "Flat",
    color: "54, 103, 176",
    duration: 440,
    contact: 0.48,
    speed: 0.95,
    minSpeed: 540,
    maxSpeed: 1420,
    gravity: 1020,
    lift: 0.045,
    magnus: 0,
    drag: 0.015,
    spin: 2,
    restitution: 0.49,
    kick: 0.92,
    trail: 23,
    poses: [rest(), pose(0.2, -10, 0, -16), pose(0.48, 28, -5, 45), pose(0.72, 48, -2, 91), finish()],
  },
  backhand: {
    name: "Backhand",
    short: "Backhand",
    color: "124, 98, 153",
    duration: 650,
    contact: 0.52,
    speed: 0.69,
    minSpeed: 410,
    maxSpeed: 1050,
    gravity: 1020,
    lift: 0.16,
    magnus: 0.08,
    drag: 0.055,
    spin: 10,
    restitution: 0.68,
    kick: 0.96,
    trail: 18,
    poses: [rest(), pose(0.23, 22, 8, 55, -1), pose(0.52, 37, -12, -8, -1), pose(0.79, 60, -32, -65, -1), finish()],
  },
  slice: {
    name: "Slice",
    short: "Slice",
    color: "75, 135, 149",
    duration: 660,
    contact: 0.54,
    speed: 0.46,
    minSpeed: 265,
    maxSpeed: 680,
    gravity: 650,
    lift: 0.05,
    magnus: -0.28,
    drag: 0.17,
    spin: -21,
    restitution: 0.27,
    kick: 0.98,
    trail: 18,
    poses: [rest(), pose(0.24, 12, -60, -22, 0.65), pose(0.54, 28, 5, 40, 0.65), pose(0.78, 52, 30, 87, 0.65), finish()],
  },
};

export function poseAt(stroke, fraction) {
  const frames = stroke.poses;
  const t = Math.max(0, Math.min(1, fraction));
  const next = frames.findIndex((frame) => frame.t >= t);
  if (next <= 0) return { ...frames[0] };
  const a = frames[next - 1],
    b = frames[next];
  const raw = (t - a.t) / (b.t - a.t);
  const blend = raw * raw * (3 - 2 * raw);
  const value = (key) => a[key] + (b[key] - a[key]) * blend;
  return { t, x: value("x"), y: value("y"), angle: value("angle"), face: value("face") };
}

export function headAt(poseValue, anchor) {
  const radians = (poseValue.angle * Math.PI) / 180;
  const scale = anchor.height / 170;
  // Contact geometry follows the displayed sprite, not a particular image size.
  const pivotX = anchor.pivotX ?? 0.235;
  const pivotY = anchor.pivotY ?? 0.968;
  const dx = anchor.width * ((anchor.headX ?? 0.53) - pivotX) * poseValue.face;
  const dy = anchor.height * ((anchor.headY ?? 0.25) - pivotY);
  return {
    x: anchor.left + anchor.width * pivotX + dx * Math.cos(radians) - dy * Math.sin(radians) + poseValue.x * scale,
    y: anchor.top + anchor.height * pivotY + dx * Math.sin(radians) + dy * Math.cos(radians) + poseValue.y * scale,
  };
}

export function createBall(mode, origin, viewport) {
  const stroke = STROKES[mode];
  const lift = Math.min(viewport.height * stroke.lift, 240);
  return {
    mode,
    x: origin.x,
    y: origin.y,
    vx: Math.min(stroke.maxSpeed, Math.max(stroke.minSpeed, viewport.width * stroke.speed)),
    vy: mode === "serve" ? stroke.down : -Math.sqrt(2 * stroke.gravity * lift),
    radius: viewport.width < 600 ? 12 : 14,
    spin: 0,
    angularVelocity: stroke.spin,
    age: 0,
    bounces: 0,
    fade: null,
    opacity: 1,
    trail: [],
    phase: "flight",
  };
}

export function advanceBall(ball, elapsed, viewport) {
  const dt = Math.max(0, Math.min(elapsed, 0.032));
  const stroke = STROKES[ball.mode];
  ball.age += dt;
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > stroke.trail) ball.trail.shift();
  ball.vx *= Math.exp(-stroke.drag * dt);
  ball.vy += (stroke.gravity + Math.abs(ball.vx) * stroke.magnus) * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.spin += ball.angularVelocity * dt;
  ball.angularVelocity *= Math.exp(-0.07 * dt);
  const events = [];
  const edge = ball.radius + 8;
  if (ball.x < edge || ball.x > viewport.width - edge) {
    ball.x = Math.max(edge, Math.min(viewport.width - edge, ball.x));
    ball.vx *= -0.84;
    ball.angularVelocity *= 0.85;
    events.push({ kind: "wall", x: ball.x, y: ball.y });
  }
  if (ball.y < edge) {
    ball.y = edge;
    ball.vy = Math.abs(ball.vy) * 0.75;
  }
  if (ball.y > viewport.height - edge && ball.vy > 0) {
    ball.y = viewport.height - edge;
    ball.vy *= -stroke.restitution;
    ball.vx *= stroke.kick;
    ball.bounces += 1;
    events.push({ kind: "bounce", x: ball.x, y: viewport.height - 8 });
  }
  if ((ball.bounces >= 3 || ball.age > 4.8) && ball.fade === null) ball.fade = ball.age;
  ball.opacity = ball.fade === null ? 1 : Math.max(0, 1 - (ball.age - ball.fade) / 0.55);
  return events;
}
