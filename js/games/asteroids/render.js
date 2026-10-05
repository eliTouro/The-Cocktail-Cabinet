import { HEIGHT, ROCK_TIERS, SAFE_RADIUS, SENDER_PANEL, SHIP, WIDTH } from './config.js';
import { sizeButtonBox } from './controllers.js';
import { polygonPoints } from './geometry.js';

const INK = '#0e0b15';
const TEXT = '#f1ebf6';
const MUTED = '#a095b3';
export const TONE_COLORS = { human: '#ffb347', computer: '#52d6ff', rock: '#e4def0' };

const GLOW_BLUR = 10;
const LINE_WIDTH = 1.8;
const BLINK_HZ = 8;
const BULLET_RADIUS = 2;
const WRAP_COPIES = [-1, 0, 1];
const FLAME_LENGTH = 11;
const FLICKER_HZ = 30;

function strokeGlowing(context, color, draw) {
  context.save();
  context.strokeStyle = color;
  context.shadowColor = color;
  context.shadowBlur = GLOW_BLUR;
  context.lineWidth = LINE_WIDTH;
  context.lineJoin = 'round';
  context.beginPath();
  draw();
  context.stroke();
  context.restore();
}

/** Draws at the object's position plus any screen-wrapped copies that are visible. */
function drawWrapped(x, y, reach, draw) {
  WRAP_COPIES.forEach((column) => WRAP_COPIES.forEach((row) => {
    const copyX = x + column * WIDTH;
    const copyY = y + row * HEIGHT;
    const isVisible = copyX > -reach && copyX < WIDTH + reach && copyY > -reach && copyY < HEIGHT + reach;
    if (isVisible) draw(copyX, copyY);
  }));
}

function tracePolygon(context, points) {
  points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.closePath();
}

function drawRock(context, rock, color) {
  const { sides, radius } = ROCK_TIERS[rock.tier];
  drawWrapped(rock.x, rock.y, radius, (x, y) => {
    strokeGlowing(context, color, () => tracePolygon(context, polygonPoints(x, y, radius, sides, rock.angle)));
  });
}

function shipOutline(x, y, angle) {
  const point = (forward, side) => ({
    x: x + Math.cos(angle) * forward - Math.sin(angle) * side,
    y: y + Math.sin(angle) * forward + Math.cos(angle) * side,
  });
  return [point(SHIP.noseOffset, 0), point(-9, 8), point(-5, 0), point(-9, -8)];
}

function drawFlame(context, ship, x, y, color, time) {
  const length = FLAME_LENGTH * (0.7 + 0.3 * Math.sin(time * FLICKER_HZ * Math.PI));
  const back = (distance, side) => ({
    x: x - Math.cos(ship.angle) * distance - Math.sin(ship.angle) * side,
    y: y - Math.sin(ship.angle) * distance + Math.cos(ship.angle) * side,
  });
  strokeGlowing(context, color, () => {
    context.moveTo(back(6, 3).x, back(6, 3).y);
    context.lineTo(back(6 + length, 0).x, back(6 + length, 0).y);
    context.lineTo(back(6, -3).x, back(6, -3).y);
  });
}

function drawShip(context, state, color) {
  const { ship } = state;
  if (!ship.alive) return;
  const isBlinkOff = ship.invulnerable > 0 && Math.floor(state.time * BLINK_HZ) % 2 === 0;
  if (isBlinkOff) return;
  drawWrapped(ship.x, ship.y, SHIP.noseOffset, (x, y) => {
    strokeGlowing(context, color, () => tracePolygon(context, shipOutline(x, y, ship.angle)));
    if (ship.thrusting) drawFlame(context, ship, x, y, color, state.time);
  });
}

function drawBullets(context, bullets, color) {
  context.save();
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = GLOW_BLUR;
  bullets.forEach((bullet) => {
    context.beginPath();
    context.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawText(context, text, x, y, { color = MUTED, align = 'left', size = 12 } = {}) {
  context.save();
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.font = `${size}px "JetBrains Mono", ui-monospace, monospace`;
  context.fillText(text, x, y);
  context.restore();
}

function drawSafeZone(context, ship, color) {
  if (!ship.alive) return;
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = 0.28;
  context.lineWidth = 1;
  context.setLineDash([4, 6]);
  context.beginPath();
  context.arc(ship.x, ship.y, SAFE_RADIUS, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawLaunchPreview(context, preview, color) {
  const { from, target, tier, canSend } = preview;
  const { sides, radius } = ROCK_TIERS[tier];
  context.save();
  context.globalAlpha = canSend ? 0.9 : 0.35;
  context.setLineDash([3, 5]);
  strokeGlowing(context, color, () => {
    context.moveTo(from.x, from.y);
    context.lineTo(target.x, target.y);
  });
  context.setLineDash([]);
  strokeGlowing(context, color, () => tracePolygon(context, polygonPoints(from.x, from.y, radius, sides, 0)));
  context.restore();
}

function drawSizeButtons(context, selectedTier, color) {
  ROCK_TIERS.forEach((tierInfo, tier) => {
    const box = sizeButtonBox(tier);
    const isSelected = tier === selectedTier;
    context.save();
    context.fillStyle = isSelected ? 'rgba(255, 179, 71, 0.16)' : 'rgba(23, 18, 33, 0.9)';
    context.strokeStyle = isSelected ? color : 'rgba(255, 255, 255, 0.14)';
    context.lineWidth = 1;
    context.fillRect(box.x, box.y, box.width, box.height);
    context.strokeRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1);
    context.restore();
    drawText(context, `${tier + 1}  ${tierInfo.name}  ${tierInfo.sendCost}`, box.x + box.width / 2, box.y + box.height / 2, {
      color: isSelected ? TEXT : MUTED, align: 'center', size: 11,
    });
  });
}

function drawBudgetMeter(context, preview, color) {
  const left = SENDER_PANEL.left + ROCK_TIERS.length * (SENDER_PANEL.buttonWidth + SENDER_PANEL.buttonGap) + 8;
  const width = WIDTH - left - SENDER_PANEL.left;
  const top = SENDER_PANEL.top + 6;
  const height = HEIGHT - SENDER_PANEL.top - 18;
  context.save();
  context.fillStyle = 'rgba(255, 255, 255, 0.08)';
  context.fillRect(left, top, width, height);
  context.fillStyle = color;
  context.globalAlpha = preview.cooldownRatio > 0 ? 0.55 : 1;
  context.fillRect(left, top, width * (preview.budget / preview.budgetCap), height);
  context.restore();
  drawText(context, 'rock budget', left, top - 6 + height + 12, { size: 10 });
}

function drawSenderPanel(context, preview, color) {
  drawSafeZone(context, preview.ship, TONE_COLORS.computer);
  drawLaunchPreview(context, preview, color);
  drawSizeButtons(context, preview.tier, color);
  drawBudgetMeter(context, preview, color);
}

/**
 * Draws one frame. `shipColor` and `rockColor` follow the cabinet's rule: amber is what the human
 * controls, cyan is what the computer controls. `preview` is only set in computer mode.
 */
export function render(context, { state, shipColor, rockColor, preview }) {
  context.fillStyle = INK;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  state.rocks.forEach((rock) => drawRock(context, rock, rockColor));
  drawBullets(context, state.bullets, shipColor);
  drawShip(context, state, shipColor);
  if (preview) drawSenderPanel(context, { ...preview, ship: state.ship }, rockColor);
}
