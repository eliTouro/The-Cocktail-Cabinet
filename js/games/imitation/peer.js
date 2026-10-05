import { ICE_GATHER_TIMEOUT_MS, ICE_SERVERS } from './config.js';
import { decodeMessage, encodeMessage } from './protocol.js';
import { CODE_KIND, decodeSignal, encodeSignal } from './signal.js';

/**
 * Thin WebRTC adapter: a direct browser-to-browser data channel, signalled by hand with two
 * copy-paste codes (invite, then reply). No relay or broker of ours or anyone else's; the only
 * outside help is the STUN server in config.js, which tells each browser its public address.
 *
 * ICE is trickle-free: each side waits until its candidates are gathered, so one code says it all.
 * The channel is pre-negotiated (same id on both sides), so neither side waits for ondatachannel.
 */
const CHANNEL = { label: 'imitation', options: { negotiated: true, id: 0 } };
const CONNECT_FAILED = 'Could not reach your friend. Check you are both online, then start a new invite.';

/** Inviter: { code, acceptReply(replyCode) -> Promise<link>, close() }. */
export async function createInvite() {
  const { connection, channel } = openPeer();
  try {
    await connection.setLocalDescription(await connection.createOffer());
    await gatheringComplete(connection);
    return {
      code: await encodeSignal(connection.localDescription),
      async acceptReply(input) {
        await connection.setRemoteDescription(await decodeSignal(input, CODE_KIND.reply));
        return whenOpen(connection, channel);
      },
      close: () => connection.close(),
    };
  } catch (error) {
    connection.close();
    throw error;
  }
}

/** Friend: { code (the reply to send back), connected: Promise<link>, close() }. */
export async function acceptInvite(inviteInput) {
  const offer = await decodeSignal(inviteInput, CODE_KIND.invite);
  const { connection, channel } = openPeer();
  try {
    await connection.setRemoteDescription(offer);
    await connection.setLocalDescription(await connection.createAnswer());
    await gatheringComplete(connection);
    return {
      code: await encodeSignal(connection.localDescription),
      connected: whenOpen(connection, channel),
      close: () => connection.close(),
    };
  } catch (error) {
    connection.close();
    throw error;
  }
}

function openPeer() {
  const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const channel = connection.createDataChannel(CHANNEL.label, CHANNEL.options);
  return { connection, channel };
}

function gatheringComplete(connection) {
  if (connection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      connection.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (connection.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    connection.addEventListener('icegatheringstatechange', onChange);
  });
}

function whenOpen(connection, channel) {
  return new Promise((resolve, reject) => {
    const onState = () => {
      if (connection.connectionState === 'failed') reject(new Error(CONNECT_FAILED));
    };
    connection.addEventListener('connectionstatechange', onState);
    channel.addEventListener('open', () => {
      connection.removeEventListener('connectionstatechange', onState);
      resolve(createLink(connection, channel));
    }, { once: true });
  });
}

/** A validated message pipe: send(message), onMessage(fn), onClose(fn), close(). */
function createLink(connection, channel) {
  const listeners = { message: () => {}, close: () => {} };
  const onMessage = (event) => {
    const message = decodeMessage(event.data);
    if (message) listeners.message(message);
  };
  const onClose = () => listeners.close();
  channel.addEventListener('message', onMessage);
  channel.addEventListener('close', onClose);

  return {
    send(message) {
      if (channel.readyState === 'open') channel.send(encodeMessage(message));
    },
    onMessage: (listener) => { listeners.message = listener; },
    onClose: (listener) => { listeners.close = listener; },
    close() {
      channel.removeEventListener('message', onMessage);
      channel.removeEventListener('close', onClose);
      channel.close();
      connection.close();
    },
  };
}
