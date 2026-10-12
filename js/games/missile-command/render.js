import {
  BLAST, GROUND_Y, HEIGHT, IMPACT_FLASH_SECONDS, IMPACT_RADIUS, WIDTH,
} from './config.js';
import { blastRadius } from './rules.js';

const INK = '#0e0b15';
const SURFACE = '#171221';
const MUTED = '#a095b3';

const GLOW_BLUR = 8;
const TRAIL_ALPHA = 0.35;
const HEAD_RADIUS = 2.5;
const CITY_WIDTH = 28;
const TOWER_WIDTHS = [7, 9, 6];
const TOWER_LEFTS = [0, 9, 21];
const TOWER_HEIGHTS = [14, 24, 17];
const BASE_HALF_WIDTH = 17;
const AMMO_PIP = { size: 3, gap: 2, perRow: 5 };
const TARGET_MARK = 4;
const RUBBLE_HEIGHT = 3;
const CROSSHAIR_RADIUS = 9;
const REACH_DASH = [4, 4];
const LANDING_MARK_HEIGHT = 10;
const LABEL_FONT = '12px system-ui, sans-serif';
const LABEL_GAP = 8;

function withGlow(context, color, draw) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = GLOW_BLUR;
  context.lineWidth = 1.6;
  draw();
  context.restore();
}

function drawSky(context) {
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, INK);
  sky.addColorStop(1, '#1b1428');
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawGround(context, color) {
  context.fillStyle = SURFACE;
  context.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  withGlow(context, color, () => {
    context.globalAlpha = 0.55;
    context.beginPath();
    context.moveTo(0, GROUND_Y);
    context.lineTo(WIDTH, GROUND_Y);
    context.stroke();
  });
}

function drawCity(context, city, color) {
  if (!city.alive) {
    context.fillStyle = MUTED;
    context.globalAlpha = 0.4;
    context.fillRect(city.x - CITY_WIDTH / 2, GROUND_Y - RUBBLE_HEIGHT, CITY_WIDTH, RUBBLE_HEIGHT);
    context.globalAlpha = 1;
    return;
  }
  withGlow(context, color, () => {
    TOWER_WIDTHS.forEach((width, index) => {
      const left = city.x - CITY_WIDTH / 2 + TOWER_LEFTS[index];
      context.fillRect(left, GROUND_Y - TOWER_HEIGHTS[index], width, TOWER_HEIGHTS[index]);
    });
  });
}

function drawAmmoPips(context, base, color) {
  for (let pip = 0; pip < base.ammo; pip += 1) {
    const column = pip % AMMO_PIP.perRow;
    const row = Math.floor(pip / AMMO_PIP.perRow);
    const x = base.x - ((AMMO_PIP.perRow * (AMMO_PIP.size + AMMO_PIP.gap)) / 2) + column * (AMMO_PIP.size + AMMO_PIP.gap);
    context.fillStyle = color;
    context.fillRect(x, GROUND_Y + 8 + row * (AMMO_PIP.size + AMMO_PIP.gap), AMMO_PIP.size, AMMO_PIP.size);
  }
}

function drawBase(context, base, color) {
  if (!base.alive) {
    context.fillStyle = MUTED;
    context.globalAlpha = 0.4;
    context.fillRect(base.x - BASE_HALF_WIDTH, GROUND_Y - RUBBLE_HEIGHT, BASE_HALF_WIDTH * 2, RUBBLE_HEIGHT);
    context.globalAlpha = 1;
    return;
  }
  withGlow(context, color, () => {
    context.globalAlpha = base.cooldown > 0 ? 0.55 : 1;
    context.beginPath();
    context.moveTo(base.x - BASE_HALF_WIDTH, GROUND_Y);
    context.lineTo(base.x - 7, GROUND_Y - 14);
    context.lineTo(base.x + 7, GROUND_Y - 14);
    context.lineTo(base.x + BASE_HALF_WIDTH, GROUND_Y);
    context.closePath();
    context.fill();
  });
  drawAmmoPips(context, base, color);
}

function drawTrail(context, flyer, color) {
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = TRAIL_ALPHA;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(flyer.fromX, flyer.fromY);
  context.lineTo(flyer.x, flyer.y);
  context.stroke();
  context.restore();
}

function drawFlyer(context, flyer, color) {
  drawTrail(context, flyer, color);
  withGlow(context, color, () => {
    context.beginPath();
    context.arc(flyer.x, flyer.y, HEAD_RADIUS, 0, Math.PI * 2);
    context.fill();
  });
}

function drawTargetMark(context, interceptor, color) {
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = 0.6;
  context.beginPath();
  context.moveTo(interceptor.tx - TARGET_MARK, interceptor.ty - TARGET_MARK);
  context.lineTo(interceptor.tx + TARGET_MARK, interceptor.ty + TARGET_MARK);
  context.moveTo(interceptor.tx + TARGET_MARK, interceptor.ty - TARGET_MARK);
  context.lineTo(interceptor.tx - TARGET_MARK, interceptor.ty + TARGET_MARK);
  context.stroke();
  context.restore();
}

function drawBlast(context, blast, color) {
  const radius = blastRadius(blast);
  if (radius <= 0) return;
  const glow = context.createRadialGradient(blast.x, blast.y, 0, blast.x, blast.y, radius);
  glow.addColorStop(0, `${color}ee`);
  glow.addColorStop(0.7, `${color}88`);
  glow.addColorStop(1, `${color}00`);
  context.save();
  context.fillStyle = glow;
  context.beginPath();
  context.arc(blast.x, blast.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawImpact(context, impact, color) {
  const progress = impact.age / IMPACT_FLASH_SECONDS;
  context.save();
  context.globalAlpha = 1 - progress;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(impact.x, impact.y, IMPACT_RADIUS * progress, Math.PI, 0);
  context.stroke();
  context.restore();
}

function drawCrosshair(context, preview, color) {
  const { x, y } = preview.position;
  const radius = CROSSHAIR_RADIUS;
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = preview.canFire ? 1 : 0.4;
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.moveTo(x - radius - 4, y);
  context.lineTo(x + radius + 4, y);
  context.moveTo(x, y - radius - 4);
  context.lineTo(x, y + radius + 4);
  context.stroke();
  context.restore();
}

/** Shows how far a counter-missile's blast will reach where it bursts. */
function drawBlastReach(context, preview, color) {
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = preview.canFire ? 0.35 : 0.15;
  context.setLineDash(REACH_DASH);
  context.beginPath();
  context.arc(preview.position.x, preview.position.y, BLAST.maxRadius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

/** Marks the spot on the ground a warhead sent from this pointer position would hit. */
function drawLandingMark(context, preview, color) {
  const x = Math.min(Math.max(preview.position.x, 0), WIDTH);
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = preview.canFire ? 0.8 : 0.3;
  context.lineWidth = 1.4;
  context.beginPath();
  context.moveTo(x - IMPACT_RADIUS, GROUND_Y);
  context.lineTo(x, GROUND_Y - LANDING_MARK_HEIGHT);
  context.lineTo(x + IMPACT_RADIUS, GROUND_Y);
  context.stroke();
  context.restore();
}

function drawRefusalLabel(context, preview, color) {
  if (preview.canFire || !preview.refusalLabel) return;
  context.save();
  context.fillStyle = color;
  context.font = LABEL_FONT;
  context.textAlign = 'center';
  context.fillText(preview.refusalLabel, preview.position.x, preview.position.y - CROSSHAIR_RADIUS - LABEL_GAP);
  context.restore();
}

/** Draws one frame. `colors` says whose hand each thing is: defender (cities, bases, blasts) and attacker (warheads). */
export function render(context, { state, preview, colors }) {
  drawSky(context);
  drawGround(context, colors.defender);
  state.cities.forEach((city) => drawCity(context, city, colors.defender));
  state.bases.forEach((base) => drawBase(context, base, colors.defender));
  state.warheads.forEach((warhead) => drawFlyer(context, warhead, colors.attacker));
  state.interceptors.forEach((interceptor) => {
    drawFlyer(context, interceptor, colors.defender);
    drawTargetMark(context, interceptor, colors.defender);
  });
  state.blasts.forEach((blast) => drawBlast(context, blast, colors.defender));
  state.impacts.forEach((impact) => drawImpact(context, impact, colors.attacker));
  if (!preview) return;
  if (preview.showsReach) drawBlastReach(context, preview, colors.crosshair);
  else drawLandingMark(context, preview, colors.crosshair);
  drawCrosshair(context, preview, colors.crosshair);
  drawRefusalLabel(context, preview, colors.crosshair);
}
