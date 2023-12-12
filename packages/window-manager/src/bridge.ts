export type Handler = (args: any, source: MessageEventSource) => void;

export type HandlerOpts = {
  [k: string]: Handler;
};

export class Bridge {
  private type: string;
  private handlers: HandlerOpts;

  constructor(opts: { type: string; handlers: HandlerOpts }) {
    const { type, handlers } = opts;
    this.type = type;
    this.handlers = handlers;
    window.addEventListener("message", this.onMessage.bind(this));
  }

  registerHandlers(handlers: HandlerOpts) {
    Object.assign(this.handlers, handlers);
  }

  onMessage({ data, origin, source }: MessageEvent) {
    // console.log("parent received: %O %O %O", data, origin, source);
    if (!isMessageData(data)) {
      return;
    }
    const { type, id, command, args } = data;
    if (type !== this.type) {
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

interface MessageData {
  type: string;
  id: string;
  command: string;
  args: any;
}

function isMessageData(data: any): data is MessageData {
  const { type, id, command } = data;
  return type && id && command;
}
