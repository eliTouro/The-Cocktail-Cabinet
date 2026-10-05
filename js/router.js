/** Routes are hash-based so the static host needs no rewrite rules: #/<game>/<mode>. */

export function hrefFor(gameId, modeId) {
  return `#/${[gameId, modeId].filter(Boolean).join('/')}`;
}

export function parseHash(hash) {
  const [gameId = '', modeId = ''] = hash.replace(/^#\/?/, '').split('/');
  return { gameId, modeId };
}

/** Calls `listener` with the current route now, and again on every change. */
export function onRouteChange(listener) {
  const notify = () => listener(parseHash(window.location.hash));
  window.addEventListener('hashchange', notify);
  notify();
}
