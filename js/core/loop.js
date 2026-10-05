const STEP_SECONDS = 1 / 60;
const MAX_FRAME_SECONDS = 0.25;

/**
 * Fixed-timestep game loop: `update(STEP_SECONDS)` runs 60 times per second of game time no
 * matter the display refresh rate, and `render()` runs once per animation frame. A fixed step
 * keeps the rules identical for every player, human or computer.
 */
export function createLoop({ update, render }) {
  let frameId = 0;
  let lastTime = 0;
  let leftoverSeconds = 0;

  function frame(now) {
    leftoverSeconds += Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
    lastTime = now;
    while (leftoverSeconds >= STEP_SECONDS) {
      update(STEP_SECONDS);
      leftoverSeconds -= STEP_SECONDS;
    }
    render();
    frameId = requestAnimationFrame(frame);
  }

  return {
    start() {
      cancelAnimationFrame(frameId);
      lastTime = performance.now();
      frameId = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(frameId);
    },
  };
}

export { STEP_SECONDS };
