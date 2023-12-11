import type { WindowManager } from "./WindowManager";
import type { HTMLWindow } from "../util/interfaces";

export class Bridge {
  windowManager!: WindowManager;
  handlers: { [k: string]: (args: any, source: MessageEventSource) => void };

  constructor({ windowManager }: { windowManager: WindowManager }) {
    this.windowManager = windowManager;
    this.handlers = {
      registerWindow: (_, child) =>
        this.windowManager.registerWindow(child as HTMLWindow),
      listWindows: () => this.windowManager.listWindows(),
      closeWindow: (id) => this.windowManager.closeWindow(id),
    };

    window.addEventListener("message", this.onMessage.bind(this));
  }

  onMessage({ data, origin, source }: MessageEvent) {
    // console.log("parent received: %O %O %O", data, origin, source);
    const { id, command, args } = data;
    if (!id || !command) {
      return;
    }
    const handler = this.handlers[command];
    if (!handler) {
      const error = `invalid command '${command}'`;
      source!.postMessage({ id, error }, { targetOrigin: origin });
      return;
    }
    try {
      const result = handler(args, source!);
      source!.postMessage({ id, result }, { targetOrigin: origin });
    } catch (err: any) {
      source!.postMessage({ id, error: err.message }, { targetOrigin: origin });
    }
  }
}
