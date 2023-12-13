let messageId = 1;
function nextMessageId() {
  return "m" + messageId++;
}

function defer<T>(): {
  resolve(data: T): void;
  reject(error?: any): void;
  promise: Promise<T>;
} {
  let deferred = {} as any;
  deferred.promise = new Promise<T>((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

function tap<T>(
  promise: Promise<T>,
  fn: (err: any, data?: T) => void
): Promise<T> {
  const { resolve, reject, promise: tapPromise } = defer<T>();
  promise.then(
    (data) => {
      fn(undefined, data);
      resolve(data);
    },
    (err) => {
      fn(err, undefined);
      reject(err);
    }
  );
  return tapPromise;
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const { resolve, reject, promise: timeoutPromise } = defer<T>();
  const token = setTimeout(() => {
    // console.log("promise timeout");
    reject(new Error("timeout!"));
  }, ms);
  tap(promise, () => {
    clearTimeout(token);
  }).then(resolve, reject);
  return timeoutPromise;
}

const type = "window-manager";

export interface MessageData {
  command: string;
  args?: any;
}

interface PostMessageData extends MessageData {
  type: string;
  id: string;
}

interface PostMessageResult {
  id: string;
  result: any;
  error: any;
}

export class Framework {
  private parentWindow!: Window;
  private targetOrigin?: string;
  private windowId!: string;
  private callbacks!: { [k: string]: (err: any, result: any) => void };

  constructor(opts?: { targetOrigin?: string }) {
    const parent = window.parent;
    if (parent === window) {
      console.log("no parent window");
      return;
    }

    opts = opts || {};
    this.parentWindow = parent;
    this.targetOrigin = opts.targetOrigin;
    this.callbacks = {};
    this.windowId = "";
    window.addEventListener("message", this.onMessage.bind(this));
    this.connect();
  }

  async sendMessage<T>(
    message: MessageData,
    opts?: { checkRegistered?: boolean }
  ): Promise<T> {
    const { checkRegistered = true } = opts || {};
    if (checkRegistered && !this.windowId) {
      throw new Error("window not registered!");
    }
    const deferred = defer<any>();
    const id = nextMessageId();
    this.callbacks[id] = (err, result) => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(result);
      }
    };
    const data: PostMessageData = { ...message, id, type };
    this.parentWindow.postMessage(data, { targetOrigin: this.targetOrigin });
    return tap(timeout(deferred.promise, 1000), () => {
      delete this.callbacks[id];
      // console.log(this.callbacks);
    });
  }

  private onMessage({ data }: MessageEvent<PostMessageResult>) {
    // console.log("page1 received:", data);
    const { id, result, error } = data;
    if (id) {
      const callback = this.callbacks[id];
      if (callback) {
        if (error) {
          callback(new Error(error), undefined);
        } else {
          callback(undefined, result);
        }
      }
    }
  }

  private async connect() {
    try {
      const id = await this.sendMessage<string>(
        { command: "connect" },
        { checkRegistered: false }
      );
      this.windowId = id;
      console.log("%s connected.", id);
    } catch (err) {
      console.error("connect failed.\n%O", err);
    }
  }

  async closeWindow() {
    if (!this.windowId) {
      console.error("window not registered!");
      return;
    }
    try {
      await this.sendMessage({ command: "close", args: this.windowId });
    } catch (err) {
      console.error("close window failed.\n%O", err);
    }
  }

  async listWindows() {
    try {
      return await this.sendMessage<string[]>({ command: "list" });
    } catch (err) {
      console.error("list windows failed.\n%O", err);
      throw err;
    }
  }
}
