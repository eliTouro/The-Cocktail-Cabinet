/**
 * Routes are hash-based so the static host needs no rewrite rules: #/<game>/<mode>.
 * An optional ?level=N after the mode jumps a game to that level (see core/level.js).
 */

export function hrefFor(gameId, modeId) {
  return `#/${[gameId, modeId].filter(Boolean).join('/')}`;
}

export function parseHash(hash) {
  const [path] = hash.replace(/^#\/?/, '').split('?');
  const [gameId = '', modeId = ''] = path.split('/');
  return { gameId, modeId };
}

/** Calls `listener` with the current route now, and again on every change. */
export function onRouteChange(listener) {
  const notify = () => listener(parseHash(window.location.hash));
  window.addEventListener('hashchange', notify);
  notify();
}
