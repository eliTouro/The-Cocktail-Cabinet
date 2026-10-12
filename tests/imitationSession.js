/**
 * A harness that runs two real Imitation sessions against each other in Node: a fake DOM just big
 * enough for dom.js, fake views that record what each player sees, a fake lobby that hands over a
 * linked pair of message pipes, a fake AI, and one shared fake clock. Messages queue up until
 * pump() delivers them, so tests can reorder, duplicate or drop them.
 */
import { decodeMessage, encodeMessage } from '../js/games/imitation/protocol.js';
import { runSession } from '../js/games/imitation/session.js';
import { createRng } from '../js/core/rng.js';

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this.ownText = null;
    this.disabled = false;
  }

  setAttribute(name, value) { this.attributes[name] = value; }
  append(...children) { this.children.push(...children); }
  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }

  get textContent() {
    return this.ownText ?? this.children.map((child) => (typeof child === 'string' ? child : child.textContent)).join('');
  }

  set textContent(value) {
    this.ownText = String(value);
    this.children = [];
  }

  click() {
    (this.listeners.click ?? []).forEach((listener) => listener({ preventDefault() {} }));
  }
}

globalThis.document ??= { createElement: (tag) => new FakeElement(tag) };

function findButton(nodes, label) {
  for (const node of nodes) {
    if (!(node instanceof FakeElement)) continue;
    if (node.tag === 'button' && node.textContent.includes(label)) return node;
    const inner = findButton(node.children, label);
    if (inner) return inner;
  }
  return null;
}

export function createClock() {
  let now = 0;
  let nextId = 1;
  const queue = new Map();
  return {
    after(ms, callback) {
      const id = nextId++;
      queue.set(id, { at: now + ms, callback });
      return id;
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...queue.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        queue.delete(due[0]);
        now = due[1].at;
        due[1].callback();
      }
      now = target;
    },
  };
}

function createFakeView(clock) {
  const seen = { cards: [], chats: [], messages: [], notes: [], revealNotes: [], scores: [], reveals: [] };
  const handlers = {};
  let shownCard = null;
  return {
    seen,
    handlers,
    /** The card on screen now, or null while the chat shows. */
    card: () => shownCard,
    showCard(card) { seen.cards.push(card); shownCard = card; },
    hideCard() { shownCard = null; },
    showChat(chat) { seen.chats.push(chat); shownCard = null; },
    setScore(text) { seen.scores.push(text); },
    addMessage(from, text) { seen.messages.push({ from, text }); },
    setTyping() {},
    setClock() {},
    showComposer(composer) { handlers.composer = composer; },
    showVerdict(onVerdict, lead) { handlers.verdict = onVerdict; seen.verdictLead = lead; },
    showDockNote(text) { seen.notes.push(text); handlers.composer = null; },
    showReveal(reveal) { seen.reveals.push(reveal); handlers.reveal = reveal; },
    setRevealNote(text, options = {}) { seen.revealNotes.push({ text, ...options }); },
    copyButton: () => new FakeElement('button'),
    after: (ms, callback) => clock.after(ms, callback),
  };
}

function createFakeGhost() {
  const ghost = { started: 0, stopped: 0, heard: [], say: null };
  return {
    ghost,
    make: () => ({
      preload() {},
      warmUp: () => Promise.resolve(),
      status: () => '',
      start({ onSay }) { ghost.started += 1; ghost.say = onSay; },
      hear: (text) => ghost.heard.push(text),
      stop() { ghost.stopped += 1; ghost.say = null; },
      destroy() {},
    }),
  };
}

function createFakePage(hash) {
  const listeners = {};
  const page = {
    hashes: [],
    location: { hash },
    history: { replaceState: (state, title, url) => page.hashes.push(url) },
    addEventListener: (type, listener) => { listeners[type] = listener; },
    removeEventListener: (type) => { delete listeners[type]; },
    fire: (type) => listeners[type]?.(),
  };
  return page;
}

/** One player: their session, plus everything they saw and heard. */
export function createPlayer(role, clock, { seed = 1, hash = `#/imitation/${role}` } = {}) {
  const view = createFakeView(clock);
  const { ghost, make } = createFakeGhost();
  const page = createFakePage(hash);
  const cues = [];
  const lobby = { shown: 0, resets: 0, joined: [], onConnected: null };
  const makeLobby = (lobbyView, { onConnected }) => {
    lobby.onConnected = onConnected;
    return {
      show: () => { lobby.shown += 1; },
      join: (code) => lobby.joined.push(code),
      reset: () => { lobby.resets += 1; },
      destroy() {},
    };
  };
  const session = runSession(view, createRng(seed), role, {
    makeLobby, makeGhostWriter: make, cue: (name) => cues.push(name), page,
  });
  return {
    view, ghost, page, cues, lobby, session,
    clickCard(label) {
      const button = findButton(view.card().body ?? [], label);
      if (!button) throw new Error(`no "${label}" button on "${view.card().title}"`);
      button.click();
    },
  };
}

/** A linked pair of message pipes, as peer.js's links. Messages wait in `wire` until pump(). */
export function createWire() {
  const wire = { queue: [], sent: [] };
  const ends = [0, 1].map((side) => ({
    side,
    listeners: { message: () => {}, close: () => {} },
    isOpen: true,
  }));
  const link = (end) => ({
    send(message) {
      if (!end.isOpen) return;
      const text = encodeMessage(message);
      wire.sent.push({ from: end.side, message });
      wire.queue.push({ to: ends[1 - end.side], text });
    },
    onMessage: (listener) => { end.listeners.message = listener; },
    onClose: (listener) => { end.listeners.close = listener; },
    close() {
      if (!end.isOpen) return;
      end.isOpen = false;
      const other = ends[1 - end.side];
      if (other.isOpen) {
        other.isOpen = false;
        other.listeners.close();
      }
    },
  });
  wire.links = ends.map(link);
  wire.pump = () => {
    while (wire.queue.length > 0) {
      const { to, text } = wire.queue.shift();
      if (to.isOpen) to.listeners.message(decodeMessage(text));
    }
  };
  /** The network drops: both ends hear the channel close, as peer.js reports a failed connection. */
  wire.drop = () => ends.forEach((end) => {
    end.isOpen = false;
    end.listeners.close();
  });
  /** Delivers a message straight to a side, as if the partner had sent it. */
  wire.inject = (side, message) => ends[side].listeners.message(decodeMessage(encodeMessage(message)));
  wire.sentTypes = (side) => wire.sent.filter((item) => item.from === side).map((item) => item.message.type);
  return wire;
}

/** Opens the channel: the inviter is wire end 0, the invitee end 1. Returns the wire. */
export function connect(inviter, invitee) {
  const wire = createWire();
  inviter.lobby.onConnected(wire.links[0], true);
  invitee.lobby.onConnected(wire.links[1], false);
  wire.pump();
  return wire;
}

/** Lets microtasks (the fake AI's warm-up promise) settle. */
export const settle = () => new Promise((resolve) => setImmediate(resolve));
