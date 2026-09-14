// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The Bare worklet core source, inlined.
 *
 * Runs inside Bare: no app imports, no Node globals — `BareKit.IPC`
 * and Bare's `Buffer` are ambient there. It lives as a template string
 * because Metro has no asset-as-string loader.
 *
 * RPC server side of the @rox/core worklet-rpc contract: decodes
 * envelopes, dispatches to the transfer core (state machines stubbed
 * until the Pear packages land in the worklet — the hyper wiring is
 * the next slice), and pushes events back to the host. The Pear-stack
 * packages (hyperdrive/hyperswarm bare-* equivalents) get required
 * lazily per command so a missing module fails one command, not the
 * whole worklet.
 */

export const CORE_SOURCE = `
const { IPC } = BareKit

const RPC_VERSION = 1

// ── Transfer state machines (mirror of HyperTransferMachine) ──
// The real machines come from @rox/core once the worklet bundles it;
// these hold the same shape so the wire contract is already honest.
function machine() {
  return { state: { kind: 'idle' } }
}
const sendMachine = machine()
const receiveMachine = machine()

function assertIdle(m, action) {
  if (m.state.kind !== 'idle') throw new Error('Cannot ' + action + ' from ' + m.state.kind)
}

// ── Peer signaling ──
// Commands that make the core dial the peer live here once the Pear
// stack loads; inbound peer signaling forwards to the host as events.

function sendEvent(event, payload) {
  IPC.write(Buffer.from(JSON.stringify({ event, kind: 'evt', payload, v: RPC_VERSION })))
}

function replyOk(id, result) {
  IPC.write(Buffer.from(JSON.stringify({ id, kind: 'res', ok: true, result, v: RPC_VERSION })))
}

function replyError(id, error) {
  IPC.write(Buffer.from(JSON.stringify({ error, id, kind: 'res', ok: false, v: RPC_VERSION })))
}

// ── Command handlers (desktop session parity) ──

const handlers = {
  'transfer:send': (payload) => {
    assertIdle(sendMachine, 'send')
    sendMachine.state = { kind: 'offering', driveKey: 'pending', name: payload.filePath, topic: 'pending' }
    sendEvent('state', sendMachine.state)
    // Pear-stack seeding lands in the next slice (TASK-6 AC #3/#4):
    // require('bare-hyperdrive') + require('bare-hyperswarm'), then
    // reply with the real { driveKey, senderId, topic }.
    throw new Error('seeding not wired yet: Pear stack lands in the worklet next slice')
  },
  'transfer:receive': (payload) => {
    assertIdle(receiveMachine, 'receive')
    receiveMachine.state = { kind: 'receiving', driveKey: payload.driveKey, topic: payload.topic }
    sendEvent('state', receiveMachine.state)
    throw new Error('replication not wired yet: Pear stack lands in the worklet next slice')
  },
  'transfer:cancel': () => {
    for (const m of [sendMachine, receiveMachine]) {
      if (m.state.kind === 'offering' || m.state.kind === 'receiving') {
        m.state = { kind: 'cancelled' }
        sendEvent('state', m.state)
      }
    }
    return { ok: true }
  },
  'transfer:release': () => ({ ok: true }),
  'peers:discover': () => ({ peers: [] }),
  'device:get': () => ({ id: '0000000000000000', name: 'android-device' }),
  'device:setName': (payload) => {
    if (!(payload.name && payload.name.length >= 1 && payload.name.length <= 64)) throw new Error('invalid name')
    return { ok: true, name: payload.name }
  },
}

// ── Frame loop ──

IPC.on('data', (data) => {
  // Decode explicitly: this may be Bare Buffer (toString decodes) or a
  // plain Uint8Array (toString yields comma-joined byte numbers).
  let text
  try {
    text = Buffer.from(data).toString('utf8')
  } catch {
    text = data.toString()
  }
  let frame
  try {
    frame = JSON.parse(text)
  } catch {
    return // non-RPC noise: ignore
  }
  if (frame.kind !== 'req' || frame.v !== RPC_VERSION) return

  const handler = handlers[frame.cmd]
  if (!handler) {
    replyError(frame.id, 'unknown command: ' + frame.cmd)
    return
  }
  try {
    replyOk(frame.id, handler(frame.payload || {}))
  } catch (err) {
    replyError(frame.id, err && err.message ? err.message : String(err))
  }
})
`;
