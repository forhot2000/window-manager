import { Bridge, HandlerOpts } from "./bridge";

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

    this.tabDragHandler(_window);

    return _window;
  }

  private tabDragHandler(_window: Window) {
    const { tab } = _window;

    let dragStartX = 0;
    let dragStartY = 0;
    let xMin = 0;
    let xMax = 0;
    let moveTo = 0;
    let hole: HTMLElement;
    let floatLayer: HTMLElement;

    const dragStart: DragStartEventHandler = (e) => {
      const x = tab.offsetLeft;
      const y = tab.offsetTop;
      const w = tab.offsetWidth;
      const h = tab.offsetHeight;
      dragStartX = e.clientX - x;
      dragStartY = e.clientY - y;
      xMin = this.tabContainer.offsetLeft;
      xMax =
        this.tabContainer.offsetLeft +
        this.tabContainer.offsetWidth -
        tab.offsetWidth;

      // save tab index
      moveTo = Array.from(this.tabContainer.children).indexOf(tab);

      // insert hole
      hole = createElement(
        `<div style="display: inline-block; width: ${w}px; height: ${h}px;"></div>`
      );
      this.tabContainer.insertBefore(hole, tab);

      // create float layer
      // width +1 to prevent line wrap
      floatLayer = createElement(
        `<div style="position: absolute; top: ${y}px; left: ${x}px; width: ${
          w + 1
        }px; height: ${h}px; z-index: 1000; overflow: visible;}"></div>`
      );
      document.body.appendChild(floatLayer);

      // move tab to float layer
      floatLayer.appendChild(tab);
    };

    const dragMove: MouseEventHandler = (e) => {
      // move flat layer follow mouse
      floatLayer.style.left = `${clamp(e.clientX - dragStartX, {
        min: xMin,
        max: xMax,
      })}px`;

      const tabs = Array.from(this.tabContainer.children);

      // compute next index
      let next = 0;
      for (let i = 0; i < tabs.length; i++) {
        const tab_i = tabs[i] as HTMLElement;
        const x_i = tab_i.offsetLeft;
        const w_i = tab_i.offsetWidth;
        if (i === moveTo) {
          if (e.clientX >= x_i && e.clientX <= x_i + w_i) {
            next = i;
            break;
          }
        } else {
          const xMid = x_i + w_i / 2;
          if (e.clientX < xMid) {
            break;
          }
          next = i + 1;
          if (i > moveTo) {
            // exclude hold
            next -= 1;
          }
        }
      }

      // move hole if index changed
      if (next !== moveTo) {
        let p = next;
        if (next > moveTo) {
          // include hold
          p += 1;
        }
        const tab_p = tabs[p] as HTMLElement;
        // TODO: add tab move animation
        this.tabContainer.insertBefore(hole, tab_p);

        // save next index
        moveTo = next;
      }
    };

    const dragEnd: MouseEventHandler = (e) => {
      const index = this.windows.indexOfWindow(_window);
      if (index !== moveTo) {
        this.windows.moveFrom(index, moveTo);
      }
      // TODO: add tab move animation
      this.tabContainer.insertBefore(tab, hole);
      hole.remove();
      floatLayer.remove();
    };

    dragHandler(tab, { dragStart, dragMove, dragEnd });
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
    _window.close();
    this.windows.delete(id);
    this.focusAt(clamp(index, { max: this.windows.size() - 1 }));
  }

  closeAllWindows() {
    const windows = this.listWindows();
    for (const _window of windows) {
      try {
        this.closeWindow(_window);
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
    return this.windows;
  }

  keys() {
    return this.ids;
  }

  delete(id: string) {
    const index = this.map.get(id);
    if (index === undefined) {
      return;
    }
    this.windows.splice(index, 1);
    this.ids.splice(index, 1);
    this.map.delete(id);
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

type MouseEventHandler = (e: MouseEvent) => void;

type DragStartEventHandler = (
  e: Pick<MouseEvent, "target" | "clientX" | "clientY">
) => void;

type DragEventHandlers = {
  dragStart?: DragStartEventHandler;
  dragMove?: MouseEventHandler;
  dragEnd?: MouseEventHandler;
};

function dragHandler(target: HTMLElement, events: DragEventHandlers) {
  const { dragStart, dragMove, dragEnd } = events;

  let dragging = false;
  let dragMask: HTMLElement;
  let downX = 0;
  let downY = 0;
  let startDragTimeout: any;

  target.addEventListener("mousedown", (e) => {
    downX = e.clientX;
    downY = e.clientY;
    target.addEventListener("mouseup", handleMouseUp);
    target.addEventListener("mousemove", handleMouseMoveStart);
    // delay to start drag, in order to handle click event
    startDragTimeout = setTimeout(startDrag, 200);
  });

  function startDrag() {
    dragging = true;
    // add layer over all sub windows
    dragMask = createElement(
      `<div style="position: absolute; top: 0; bottom: 0; left: 0; right: 0; background-color: #00000000; z-index: 9999;"></div>`
    );
    document.body.appendChild(dragMask);
    target.removeEventListener("mouseup", handleMouseUp);
    target.removeEventListener("mousemove", handleMouseMoveStart);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    const e = { target, clientX: downX, clientY: downY };
    dragStart?.(e);
  }

  function endDrag(e: MouseEvent) {
    dragging = false;
    dragMask.remove();
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    dragEnd?.(e);
  }

  function handleMouseMoveStart(e: MouseEvent) {
    if (e.movementX > 3) {
      clearTimeout(startDragTimeout);
      startDrag();
    }
  }

  function handleMouseMove(e: MouseEvent) {
    dragMove?.(e);
  }

  function handleMouseUp(e: MouseEvent) {
    if (!dragging) {
      clearTimeout(startDragTimeout);
      target.click();
    } else {
      endDrag(e);
    }
  }
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
