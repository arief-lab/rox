import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

/** Events streamed back from the main process during a transfer. */
export type TransferEvent =
  | { type: 'state'; kind: string }
  | { type: 'error'; message: string }
  | { type: 'done'; path?: string }

export type TransferResult<S> =
  | ({ ok: true } & S)
  | { ok: false; error: string }

const handler = {
  send<T>(channel: string, value?: T) {
    ipcRenderer.send(channel, value)
  },
  on<T>(channel: string, callback: (...args: T[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: T[]) =>
      callback(...args)
    ipcRenderer.on(channel, subscription)

    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },

  // ── Transfer (Hyperdrive path) ────────────────────────────────
  transfer: {
    /** Seed a local file; resolves once the drive is announced. */
    sendFile(filePath: string): Promise<
      TransferResult<{ driveKey: string; topic: string }>
    > {
      return ipcRenderer.invoke('transfer:send', filePath)
    },
    /** Replicate an offered drive; resolves with the saved file path. */
    receive(driveKey: string, topic: string): Promise<
      TransferResult<{ path: string }>
    > {
      return ipcRenderer.invoke('transfer:receive', driveKey, topic)
    },
    cancel(): Promise<TransferResult<Record<string, never>>> {
      return ipcRenderer.invoke('transfer:cancel')
    },
    release(): Promise<TransferResult<Record<string, never>>> {
      return ipcRenderer.invoke('transfer:release')
    },
    /** Subscribe to transfer events; returns an unsubscribe function. */
    onEvent(callback: (event: TransferEvent) => void): () => void {
      const listener = (_event: IpcRendererEvent, payload: TransferEvent) =>
        callback(payload)
      ipcRenderer.on('transfer:event', listener)
      return () => ipcRenderer.removeListener('transfer:event', listener)
    },
  },
}

contextBridge.exposeInMainWorld('ipc', handler)

export type IpcHandler = typeof handler
