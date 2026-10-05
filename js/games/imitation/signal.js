/**
 * Turns a WebRTC offer/answer into a short copy-paste code and back. Pure: works in browsers and
 * in Node (both have CompressionStream, Blob, Response, btoa and atob).
 *
 * A data-channel SDP is mostly boilerplate. Only a few fields differ between connections: the ICE
 * username and password, the DTLS certificate fingerprint, the DTLS role, the media id and the
 * network candidates. We keep just those, deflate them if that helps, and rebuild a standard SDP
 * on the other side.
 */
export const CODE_KIND = { invite: 'I', reply: 'R' };

const FORMAT = { plain: '0', deflated: '1' };
const SETUP_ROLES = { actpass: 'p', active: 'a', passive: 's' };
const CANDIDATE_TYPES = { host: 'h', srflx: 's' };
const CANDIDATE_PRIORITY = { host: 2122260223, srflx: 1686052607 };
const MAX_CANDIDATES = 6;
const FIELD = '|';
const LIST = ';';
const PART = ',';
const INVITE_PATH = '#/imitation/human/join/';

export class SignalCodeError extends Error {}

/** `description` is { type: 'offer' | 'answer', sdp }. */
export async function encodeSignal(description) {
  const kind = description.type === 'offer' ? CODE_KIND.invite : CODE_KIND.reply;
  const text = packSdp(description.sdp);
  const plain = new TextEncoder().encode(text);
  const deflated = await deflate(plain);
  const useDeflated = deflated.length < plain.length;
  return kind + (useDeflated ? FORMAT.deflated : FORMAT.plain) + toBase64Url(useDeflated ? deflated : plain);
}

/** Accepts a bare code or a whole invite link. Throws SignalCodeError with a friendly message. */
export async function decodeSignal(input, expectedKind) {
  const code = extractCode(input);
  if (!code) throw new SignalCodeError('That box is empty. Paste the code your friend sent you.');
  const kind = code[0];
  if (kind !== expectedKind) throw new SignalCodeError(wrongKindMessage(kind, expectedKind));
  try {
    const bytes = fromBase64Url(code.slice(2));
    const text = new TextDecoder().decode(code[1] === FORMAT.deflated ? await inflate(bytes) : bytes);
    return { type: kind === CODE_KIND.invite ? 'offer' : 'answer', sdp: unpackSdp(text) };
  } catch {
    throw new SignalCodeError('That code looks cut off or mistyped. Copy the whole code again and paste it here.');
  }
}

export function inviteLink(pageUrl, code) {
  return pageUrl.split('#')[0] + INVITE_PATH + code;
}

/** The invite code carried by a link's hash, or null. */
export function readInviteFromHash(hash) {
  const match = /\/join\/([A-Za-z0-9_-]+)/.exec(hash);
  return match ? match[1] : null;
}

function extractCode(input) {
  const trimmed = String(input ?? '').replace(/\s+/g, '');
  return readInviteFromHash(trimmed) ?? trimmed;
}

function wrongKindMessage(kind, expectedKind) {
  if (kind === CODE_KIND.invite && expectedKind === CODE_KIND.reply) {
    return 'That is your own invite code. Paste the reply code your friend sends back.';
  }
  if (kind === CODE_KIND.reply && expectedKind === CODE_KIND.invite) {
    return 'That is a reply code. It goes in the box on the inviter\'s screen.';
  }
  return 'That does not look like an Imitation code. Copy it again from your friend\'s screen.';
}

/* ---------- SDP <-> compact text ---------- */

export function packSdp(sdp) {
  const lines = sdp.split(/\r?\n/);
  const value = (prefix) => lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim();
  const fingerprint = value('a=fingerprint:');
  const [algorithm, hex] = (fingerprint ?? '').split(' ');
  if (algorithm !== 'sha-256' || !hex) throw new Error('unsupported fingerprint');
  const candidates = lines.filter((line) => line.startsWith('a=candidate:')).map(parseCandidate).filter(Boolean);
  return [
    value('a=ice-ufrag:'),
    value('a=ice-pwd:'),
    toBase64Url(hexToBytes(hex)),
    SETUP_ROLES[value('a=setup:')],
    value('a=mid:'),
    uniqueByAddress(candidates).slice(0, MAX_CANDIDATES).map(packCandidate).join(LIST),
  ].join(FIELD);
}

export function unpackSdp(text) {
  const [ufrag, pwd, fingerprint, setup, mid, candidateList] = text.split(FIELD);
  const role = Object.keys(SETUP_ROLES).find((name) => SETUP_ROLES[name] === setup);
  if (!ufrag || !pwd || !fingerprint || !role || mid == null) throw new Error('incomplete code');
  const candidates = candidateList ? candidateList.split(LIST).map(unpackCandidate) : [];
  return [
    'v=0',
    'o=- 1 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    `a=group:BUNDLE ${mid}`,
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=fingerprint:sha-256 ${bytesToHex(fromBase64Url(fingerprint))}`,
    `a=setup:${role}`,
    `a=mid:${mid}`,
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    ...candidates.map(candidateLine),
    'a=end-of-candidates',
    '',
  ].join('\r\n');
}

/** Only UDP host and server-reflexive candidates for component 1 matter for a data channel. */
function parseCandidate(line) {
  const parts = line.slice('a=candidate:'.length).split(' ');
  const [, component, protocol, , address, port, , type] = parts;
  if (component !== '1' || protocol.toLowerCase() !== 'udp' || !(type in CANDIDATE_TYPES)) return null;
  return { type, address, port };
}

function uniqueByAddress(candidates) {
  const seen = new Set();
  return candidates.filter(({ address, port }) => {
    const key = `${address}:${port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const packCandidate = ({ type, address, port }) => [CANDIDATE_TYPES[type], address, port].join(PART);

function unpackCandidate(text) {
  const [typeCode, address, port] = text.split(PART);
  const type = Object.keys(CANDIDATE_TYPES).find((name) => CANDIDATE_TYPES[name] === typeCode);
  if (!type || !address || !/^\d+$/.test(port)) throw new Error('bad candidate');
  return { type, address, port };
}

function candidateLine({ type, address, port }, index) {
  const related = type === 'srflx' ? ' raddr 0.0.0.0 rport 0' : '';
  return `a=candidate:${index + 1} 1 udp ${CANDIDATE_PRIORITY[type]} ${address} ${port} typ ${type}${related}`;
}

/* ---------- Bytes ---------- */

async function deflate(bytes) {
  return pipeBytes(bytes, new CompressionStream('deflate-raw'));
}

async function inflate(bytes) {
  return pipeBytes(bytes, new DecompressionStream('deflate-raw'));
}

async function pipeBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('not base64url');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hexToBytes(hex) {
  return Uint8Array.from(hex.split(':'), (pair) => parseInt(pair, 16));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(':');
}
