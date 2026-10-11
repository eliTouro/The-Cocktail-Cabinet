import { h } from './dom.js';
import { isMuted, onMuteChange, play, setMuted } from './core/sound.js';

const SPEAKER_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/** A fixed speaker button that mutes or unmutes every game. The choice is remembered. */
export function createMuteToggle() {
  const button = h('button', { class: 'mute-toggle', type: 'button' });

  function refresh(muted) {
    button.innerHTML = muted ? SPEAKER_OFF : SPEAKER_ON;
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off');
  }

  button.addEventListener('click', () => {
    setMuted(!isMuted());
    play('click');
  });
  onMuteChange(refresh);
  refresh(isMuted());
  return button;
}
