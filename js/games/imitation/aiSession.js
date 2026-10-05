import { h } from '../../dom.js';
import { MATCHMAKING, PARTNER_LABEL, POINTS, TOTAL_ROUNDS, tuningForRound } from './config.js';
import { ENGINE_STATE, startEngine } from './engine.js';
import { humanityScore, judgeVerdict } from './judge.js';
import { PHASE, SIDE, createMatch, currentResult, endChat, fileVerdict, nextRound, startChat } from './match.js';
import { STILL_SEARCHING_LINE, planMatchmaking } from './matchmaking.js';
import { createPersona } from './persona.js';
import { createStranger } from './stranger.js';
import { finalSummary, revealLines, startCountdown } from './summary.js';

const INTRO_DETAIL = [
  `You will chat with ${TOTAL_ROUNDS} strangers, one per round, then say whether each was a human or an AI.`,
  `Read: +${POINTS.read} for a right verdict. Pass: +${POINTS.pass} if the stranger's judge decides you sound human.`,
  'Rounds get shorter and the judge gets stricter. Short, casual and curious reads as human; long and polished reads as a bot.',
  'The stranger runs entirely in your browser (an open language model on WebGPU, or a built-in chat script). Nothing you type leaves this device. The first time, it can take a minute to warm up.',
];

/** "Play the AI": simulated matchmaking, a chat with the in-browser AI, verdict, reveal. */
export function runAiSession(view, rng) {
  let match = createMatch({ totalRounds: TOTAL_ROUNDS });
  let engine = null;
  let progress = 0;
  let stranger = null;
  let stopClock = () => {};
  let myMessages = [];
  const wait = (ms) => new Promise((resolve) => view.after(ms, resolve));

  function showIntro() {
    view.showCard({
      eyebrow: 'Imitation · Play the AI',
      title: 'Human or machine?',
      body: INTRO_DETAIL.map((text) => h('p', { class: 'imx-card__text' }, text)),
      actions: [{ label: 'Find a stranger', onClick: beginMatch }],
    });
  }

  function beginMatch() {
    match = createMatch({ totalRounds: TOTAL_ROUNDS });
    engine ??= startEngine({ rng, onProgress: (value) => { progress = value; } });
    view.setScores(0, 0, PARTNER_LABEL);
    searchForPartner();
  }

  async function searchForPartner() {
    const plan = planMatchmaking(rng);
    const statusLine = h('p', { class: 'imx-search__status', 'aria-live': 'polite' });
    const warmLine = h('p', { class: 'imx-search__warm' });
    view.showCard({
      eyebrow: `Round ${match.round + 1} of ${TOTAL_ROUNDS}`,
      title: 'Searching for a partner…',
      body: [h('div', { class: 'imx-radar', 'aria-hidden': 'true' }), statusLine, warmLine],
    });
    const showWarmth = () => { warmLine.textContent = warmthText(); };
    let elapsed = 0;
    for (const { atMs, text } of plan.statuses) {
      await wait(atMs - elapsed);
      elapsed = atMs;
      statusLine.textContent = text;
      showWarmth();
    }
    await waitForEngine(statusLine, showWarmth);
    openChat();
  }

  async function waitForEngine(statusLine, showWarmth) {
    const capMs = MATCHMAKING.engineWaitCapSeconds * 1000;
    const stepMs = MATCHMAKING.statusEverySeconds * 1000;
    for (let waited = 0; engine.state() === ENGINE_STATE.warming && waited < capMs; waited += stepMs) {
      statusLine.textContent = STILL_SEARCHING_LINE;
      showWarmth();
      await wait(stepMs);
    }
  }

  function warmthText() {
    if (engine.state() === ENGINE_STATE.warming) return `Warming up the in-browser chat · ${Math.round(progress * 100)}%`;
    if (engine.state() === ENGINE_STATE.fallback) return engine.failure();
    return '';
  }

  function openChat() {
    const tuning = tuningForRound(match.round);
    startChat(match);
    myMessages = [];
    view.showChat({ partnerLabel: PARTNER_LABEL, round: match.round, totalRounds: TOTAL_ROUNDS });
    stranger = createStranger({
      getEngine: engine.current,
      persona: createPersona(rng, tuning.personaPolish),
      rng,
      onTyping: view.setTyping,
      onSay: (text) => view.addMessage('partner', text),
    });
    view.showComposer({ onSend: send, onCallIt: () => callItEarly(tuning) });
    stranger.start();
    stopClock = startCountdown(tuning.roundSeconds, {
      onTick: view.setClock,
      onDone: () => timeUp(tuning),
    });
  }

  function callItEarly(tuning) {
    stopClock();
    timeUp(tuning, 'Your call.');
  }

  function send(text) {
    myMessages.push(text);
    view.addMessage('me', text);
    stranger.hear(text);
  }

  function timeUp(tuning, lead) {
    stranger.stop();
    endChat(match);
    view.showVerdict(PARTNER_LABEL, (verdict) => {
      fileVerdict(match, SIDE.partner, { verdict: judgeVerdict(myMessages, tuning.judgeBar), wasAi: true });
      fileVerdict(match, SIDE.me, { verdict, wasAi: false });
      showReveal(tuning);
    }, lead);
  }

  function showReveal(tuning) {
    const score = Math.round(humanityScore(myMessages) * 100);
    const bar = Math.round(tuning.judgeBar * 100);
    const isLast = match.round + 1 >= TOTAL_ROUNDS;
    view.setScores(match.totals.me, match.totals.partner, PARTNER_LABEL);
    view.showReveal({
      partnerWasAi: true,
      lines: [
        ...revealLines(currentResult(match), PARTNER_LABEL),
        `Its judge rated you ${score}% human; this round needed ${bar}%. It was played by ${engineName()}.`,
      ],
      actionLabel: isLast ? 'See final score' : 'Next stranger',
      onAction: advance,
    });
  }

  function engineName() {
    return engine.current().kind === 'webllm' ? 'a small language model in your browser' : 'the built-in chat script';
  }

  function advance() {
    nextRound(match);
    if (match.phase === PHASE.over) showFinal();
    else searchForPartner();
  }

  function showFinal() {
    view.showCard({
      eyebrow: 'Final score',
      title: `${match.totals.me} : ${match.totals.partner}`,
      body: [h('p', { class: 'imx-card__text' }, finalSummary(match.totals, PARTNER_LABEL))],
      actions: [{ label: 'Play again', onClick: beginMatch }],
    });
  }

  showIntro();

  return {
    destroy() {
      stopClock();
      stranger?.stop();
      engine?.destroy();
    },
  };
}
