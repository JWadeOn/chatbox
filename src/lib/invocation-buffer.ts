import type { JsonRpcRequest } from './postmessage';

export class InvocationBuffer {
  private iframeReady = false;
  private queue: JsonRpcRequest[] = [];
  private sendFn: ((msg: JsonRpcRequest) => void) | null = null;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;
  private onTimeout: (() => void) | null = null;

  constructor(sendFn: (msg: JsonRpcRequest) => void, onTimeout?: () => void, timeoutMs = 10000) {
    this.sendFn = sendFn;
    this.onTimeout = onTimeout || null;

    this.readyTimeout = setTimeout(() => {
      if (!this.iframeReady) {
        this.onTimeout?.();
      }
    }, timeoutMs);
  }

  enqueue(msg: JsonRpcRequest) {
    if (this.iframeReady) {
      this.sendFn?.(msg);
    } else {
      this.queue.push(msg);
    }
  }

  markReady() {
    this.iframeReady = true;
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }
    for (const msg of this.queue) {
      this.sendFn?.(msg);
    }
    this.queue = [];
  }

  isReady(): boolean {
    return this.iframeReady;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  destroy() {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
    }
    this.queue = [];
    this.sendFn = null;
    this.onTimeout = null;
  }
}
