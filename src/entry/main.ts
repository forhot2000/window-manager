import { Bridge } from "../lib/Bridge";
import { WindowManager } from "../lib/WindowManager";

export const windowManager = new WindowManager();
export const bridge = new Bridge({ windowManager });
