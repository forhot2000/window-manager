export type Handler = (args: any, source: MessageEventSource) => void;

export type HandlerOpts = {
  [k: string]: Handler;
};
