import { HEIGHT, WIDTH } from './config.js';

/** Shortest signed distance from `from` to `to` on a wrapping axis of length `size`. */
export function wrapDelta(from, to, size) {
  let delta = (to - from) % size;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

export const wrapCoordinate = (value, size) => ((value % size) + size) % size;

/** Distance between two points on the wrapping screen. */
export function wrappedDistance(a, b) {
  return Math.hypot(wrapDelta(a.x, b.x, WIDTH), wrapDelta(a.y, b.y, HEIGHT));
}

export function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Corner points of a rock's regular polygon in world space, around (centerX, centerY). */
export function polygonPoints(centerX, centerY, radius, sides, angle) {
  return Array.from({ length: sides }, (_, index) => {
    const corner = angle + (index / sides) * Math.PI * 2;
    return { x: centerX + Math.cos(corner) * radius, y: centerY + Math.sin(corner) * radius };
  });
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point, a, b) {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const along = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared;
  const t = Math.min(Math.max(along, 0), 1);
  return Math.hypot(point.x - (a.x + t * (b.x - a.x)), point.y - (a.y + t * (b.y - a.y)));
}

/** True when a circle overlaps a polygon: its centre is inside, or an edge passes within `radius`. */
export function circleHitsPolygon(circle, radius, polygon) {
  if (pointInPolygon(circle, polygon)) return true;
  return polygon.some((a, index) => distanceToSegment(circle, a, polygon[(index + 1) % polygon.length]) <= radius);
}

/** The point on the screen border closest to `point`. */
export function nearestEdgePoint({ x, y }) {
  const candidates = [
    { edge: { x: 0, y }, away: x },
    { edge: { x: WIDTH, y }, away: WIDTH - x },
    { edge: { x, y: 0 }, away: y },
    { edge: { x, y: HEIGHT }, away: HEIGHT - y },
  ];
  return candidates.reduce((best, candidate) => (candidate.away < best.away ? candidate : best)).edge;
}
