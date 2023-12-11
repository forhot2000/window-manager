export type Handler = (args: any, source: MessageEventSource) => void;

export type HandlerOpts = {
  [k: string]: Handler;
};

export class Bridge {
  private handlers: HandlerOpts;

  constructor(handlers: HandlerOpts) {
    this.handlers = handlers;
    window.addEventListener("message", this.onMessage.bind(this));
  }

  registerHandlers(handlers: HandlerOpts) {
    Object.assign(this.handlers, handlers);
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
