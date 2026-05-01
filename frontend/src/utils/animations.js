export const lerp = (a, b, t) => a + (b - a) * t;

export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeOut = t => 1 - Math.pow(1 - t, 4);
