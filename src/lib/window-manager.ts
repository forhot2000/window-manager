import { Bridge, HandlerOpts } from "./bridge";
import { tabDragHandler } from "./tab-drag-handler";

type HTMLWindow = globalThis.Window;

type OpenWindowOpts = {
  id?: string;
  title?: string;
  fixed?: boolean;
  inBackground?: boolean;
};

type CreateWindowOpts = {
  id: string;
  href: string;
} & Omit<OpenWindowOpts, "id" | "inBackground">;

export class WindowManager {
  private windows: WindowCollection;
  private activeWindowId?: string;
  private tabContainer!: HTMLElement;
  private windowContainer!: HTMLElement;
  private bridge: Bridge;

  constructor() {
    this.windows = new WindowCollection();

    document.addEventListener("click", this.onClick.bind(this));

    this.tabContainer = document.querySelector(".window-tab-container")!;
    this.windowContainer = document.querySelector(".window-panel-container")!;

    tabDragHandler(this.tabContainer, {
      onEnd: ({ from, to }) => {
        // NOTICE: animation is not ended.
        this.windows.moveFrom(from, to);
      },
    });

    this.bridge = new Bridge({
      type: "window-manager",
      handlers: {
        connect: (_, source) => this.connectWindow(source as HTMLWindow),
        list: () => this.listWindows(),
        close: (id) => this.closeWindow(id),
      },
    });
  }

  listWindows() {
    return this.windows.keys();
  }

  private findWindowByFrame(frame: HTMLElement) {
    return this.windows.find((_window) => {
      return _window.frame === frame;
    });
  }

  private createWindow(opts: CreateWindowOpts) {
    const { id, href, title, fixed } = opts;

    const tab = createElement(`
      <div class="window-tab" data-tab="${id}">
        <span>${title || id}</span>
        <span class="close" title="close this window">X</span>
      </div>`);
    this.tabContainer!.appendChild(tab);

    const panel = createElement(`
      <div id="${id}" class="window-panel">
        <iframe src="${href}" frameborder="0"></iframe>
      </div>`);
    this.windowContainer!.appendChild(panel);

    const frame = panel.querySelector("iframe")!;
    const closeButton = tab.querySelector(".close")!;

    if (fixed) {
      addClass(tab, "fixed");
    }

    tab.addEventListener("click", (e) => {
      e.stopPropagation();
      this.focus(id);
    });

    if (closeButton) {
      closeButton.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeWindow(id);
      });
    }

    const _window = new Window({
      id,
      tab,
      panel,
      frame,
      fixed,
    });

    return _window;
  }

  closeWindow(id: string) {
    console.log("close window " + id);
    const index = this.windows.indexOf(id);
    if (index < 0) {
      throw new Error("window not found.");
    }
    const _window = this.windows.getAt(index);
    if (_window.fixed) {
      throw new Error("can't close fixed window!");
    }
    // TODO: close tab animation
    _window.close();
    this.windows.delete(id);
    this.focusAt(clamp(index, { max: this.windows.size() - 1 }));
  }

  closeAllWindows() {
    const windows = this.listWindows();
    for (const id of windows) {
      try {
        this.closeWindow(id);
      } catch (err) {}
    }
  }

  private connectWindow(child: HTMLWindow) {
    const frame = findFrame(child)!;
    let _window = this.findWindowByFrame(frame);
    if (!_window) {
      throw new Error("window not found.");
    }
    _window.state = "ready";
    return _window.id;
  }

  focus(id: string) {
    const _window = this.windows.get(id);
    if (!_window) {
      throw new Error("window not found.");
    }
    this.focusWindow(_window);
  }

  focusAt(index: number) {
    if (index < 0 || index >= this.windows.size()) {
      throw new Error("index out of range.");
    }
    const _window = this.windows.getAt(index);
    this.focusWindow(_window);
  }

  private focusWindow(_window: Window) {
    const lastWindow = this.getActiveWindow();
    if (lastWindow) {
      lastWindow.blur();
    }
    _window.focus();
    this.activeWindowId = _window.id;
  }

  private getActiveWindow() {
    return this.activeWindowId
      ? this.windows.get(this.activeWindowId)
      : undefined;
  }

  private onClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (isLinkElement(target)) {
      const id = target.getAttribute("data-tab");
      if (id) {
        e.preventDefault();
        const href = target.href;
        const title =
          target.getAttribute("data-title") || target.innerText.trim();
        this.openWindow(href, { id, title });
      }
    }
  }

  openWindow(href: string, opts?: OpenWindowOpts) {
    const { id: _id, inBackground, ...rest } = opts || {};
    let id = _id || nextWindowId();
    // console.log(`open '${href}' in window '${id}'`);
    const _window = this.windows.get(id);
    if (!_window) {
      this.windows.set(id, this.createWindow({ id, href, ...rest }));
    }
    if (!inBackground) {
      this.focus(id);
    }
  }

  registerHandlers(handlers: HandlerOpts) {
    this.bridge.registerHandlers(handlers);
  }
}

class WindowCollection {
  private windows: Window[];
  private ids: string[];
  private map: Map<string, number>;

  constructor() {
    this.windows = [];
    this.ids = [];
    this.map = new Map();
  }

  has(id: string) {
    return this.map.has(id);
  }

  get(id: string) {
    const index = this.map.get(id);
    return index === undefined ? undefined : this.windows[index];
  }

  getAt(index: number) {
    return this.windows[index];
  }

  indexOf(id: string) {
    const index = this.map.get(id);
    return index === undefined ? -1 : index;
  }

  indexOfWindow(_window: Window) {
    return this.windows.indexOf(_window);
  }

  find(filter: (_window: Window, id: string, index: number) => boolean) {
    for (let i = 0; i < this.windows.length; i++) {
      const _window = this.windows[i];
      const id = this.ids[i];
      if (filter(_window, id, i)) {
        return _window;
      }
    }
    return undefined;
  }

  set(id: string, _window: Window) {
    const index = this.map.get(id);
    if (index === undefined) {
      this.windows.push(_window);
      this.ids.push(id);
      this.map.set(id, this.windows.length - 1);
    }
  }

  values() {
    // return clone copy
    return Array.from(this.windows);
  }

  keys() {
    // return clone copy
    return Array.from(this.ids);
  }

  delete(id: string) {
    const index = this.map.get(id);
    if (index === undefined) {
      return;
    }
    this.windows.splice(index, 1);
    this.ids.splice(index, 1);
    this.map.delete(id);
    for (let i = index; i < this.ids.length; i++) {
      const id = this.ids[i];
      this.map.set(id, i);
    }
    // console.log(this.windows, this.ids, this.map);
  }

  size() {
    return this.windows.length;
  }

  moveFrom(index: number, toIndex: number) {
    const _window = this.windows[index];
    this.windows.splice(index, 1);
    this.windows.splice(toIndex, 0, _window);

    const id = this.ids[index];
    this.ids.splice(index, 1);
    this.ids.splice(toIndex, 0, id);

    if (index < toIndex) {
      for (let i = index; i <= toIndex; i++) {
        const id = this.ids[i];
        this.map.set(id, i);
      }
    } else {
      for (let i = toIndex; i <= index; i++) {
        const id = this.ids[i];
        this.map.set(id, i);
      }
    }

    // console.log(`move: ${index} -> ${toIndex}`);
    // console.log(this.windows, this.ids, this.map);
  }
}

class Window {
  id!: string;
  tab!: HTMLElement;
  panel!: HTMLElement;
  frame!: HTMLElement;
  fixed: boolean = false;
  state: string = "init";

  constructor(opts: {
    id: string;
    tab: HTMLElement;
    panel: HTMLElement;
    frame: HTMLElement;
    fixed?: boolean;
    state?: string;
  }) {
    Object.assign(this, opts);
  }

  focus() {
    addClass(this.tab, "active");
    addClass(this.panel, "active");
  }

  blur() {
    removeClass(this.tab, "active");
    removeClass(this.panel, "active");
  }

  close() {
    this.tab.remove();
    this.panel.remove();
  }
}

let windowId = 1;
function nextWindowId() {
  return "w" + windowId++;
}

function hasClass(element: HTMLElement, className: string) {
  const _className = element.className.trim();
  if (!_className) {
    return false;
  }
  const array = _className.split(" ");
  return array.indexOf(className) >= 0;
}

function addClass(element: HTMLElement, className: string) {
  const _className = element.className.trim();
  if (_className) {
    const array = _className.split(" ");
    if (array.indexOf(className) < 0) {
      element.className += " " + className;
    }
  } else {
    element.className = className;
  }
}

function removeClass(element: HTMLElement, className: string) {
  const _className = element.className.trim();
  if (_className) {
    const array = _className.split(" ");
    if (array.indexOf(className) >= 0) {
      const newClassName = array.filter((c: any) => c !== className).join(" ");
      element.className = newClassName;
    }
  }
}

function clamp(value: number, { min = 0, max = 1 }) {
  return value < min ? min : value > max ? max : value;
}

function createElement(html: string) {
  let temp = document.createElement("template");
  html = html.trim(); // Never return a space text node as a result
  temp.innerHTML = html;
  return temp.content.firstChild as HTMLElement;
}

function findFrame(childWindow: HTMLWindow) {
  let frame;
  const frames = document.querySelectorAll("iframe");
  for (let i = 0; i < frames.length; i++) {
    const _frame = frames[i];
    if (_frame.contentWindow === childWindow) {
      frame = _frame;
      break;
    }
  }
  return frame;
}

function isLinkElement(target: HTMLElement): target is HTMLLinkElement {
  return target.nodeName === "A";
}
