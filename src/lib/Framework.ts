import { defer } from "../util/defer";
import { HTMLWindow } from "../util/interfaces";

let messageId = 1;
function nextMessageId() {
  return "m" + messageId++;
}

export class Framework {
  parent!: HTMLWindow;
  targetOrigin?: string;
  callbacks!: { [k: string]: (err: any, result: any) => void };
  windowId!: string;

  constructor(opts?: { targetOrigin?: string }) {
    const parent = window.parent;
    if (parent === window) {
      console.log("no parent window");
      return;
    }

    opts = opts || {};
    this.parent = parent;
    this.targetOrigin = opts.targetOrigin;
    this.callbacks = {};
    this.windowId = "";
    window.addEventListener("message", this.onMessage.bind(this));
    this.registerWindow();
  }

  async sendMessage(message: any) {
    const deferred = defer();
    const id = nextMessageId();
    this.callbacks[id] = (err, result) => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(result);
      }
    };
    this.parent.postMessage(
      { ...message, id },
      { targetOrigin: this.targetOrigin }
    );
    return deferred.promise;
  }

  onMessage({ data }: MessageEvent) {
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
        delete this.callbacks[id];
      }
    }
  }

  async registerWindow() {
    try {
      const id = await this.sendMessage({ command: "registerWindow" });
      this.windowId = id;
      console.log("registered window: " + id);
    } catch (err) {
      console.error("registered window failed.\n%O", err);
    }
  }

  async closeWindow() {
    try {
      await this.sendMessage({ command: "closeWindow", args: this.windowId });
    } catch (err) {
      console.error("close window failed.\n%O", err);
    }
  }

  async listWindows() {
    try {
      return await this.sendMessage({ command: "listWindows" });
    } catch (err) {
      console.error("list windows failed.\n%O", err);
      throw err;
    }
  }
}
