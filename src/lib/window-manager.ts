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

    this.tabDragHandler(this.tabContainer, {
      onEnd: ({ from, to }) => {
        // console.log("move: %d -> %d", from, to);
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

  private tabDragHandler(
    container: HTMLElement,
    opts: { onEnd(result: { from: number; to: number }): void }
  ) {
    type Animation = {
      from: number;
      to: number;
      value: number;
      moving: boolean;
    };

    type AnimationTab = {
      element: HTMLElement;
      offsetLeft: number;
      offsetWidth: number;
      animation: Animation;
    };

    const parent = container;
    const { onEnd } = opts;
    const speed = 8;

    let dragTarget: HTMLElement;
    let lastHolder: HTMLElement;
    // x to the left of drag target
    let dragOffsetX = 0;
    // y to the top of drag target
    let dragOffsetY = 0;
    // the min x of move range
    let xMin = 0;
    // the max x of move range
    let xMax = 0;
    // the index of drag target move to
    let moveTo = 0;

    let animationExecuting = false;
    let animationTabs: AnimationTab[] = [];
    let animation: Animation = {
      from: 0,
      to: 0,
      value: 0,
      moving: false,
    };
    let animationTimer: number;

    function getDir(to: number, from: number) {
      return to - from < 0 ? -1 : 1;
    }

    function clampMove(a: Animation, s: number) {
      a.value += s;
      if (s > 0) {
        if (a.value > a.to) {
          a.value = a.to;
          a.moving = false;
        }
      } else {
        if (a.value < a.to) {
          a.value = a.to;
          a.moving = false;
        }
      }
    }

    function animationStep(timestamp: number) {
      let hasAnimation = false;

      for (let i = 0; i < animationTabs.length; i++) {
        const at = animationTabs[i];
        const { element: tab, animation: a } = at;
        if (a.moving) {
          hasAnimation = true;
          const dir = getDir(a.to, a.from);
          clampMove(a, speed * dir);
          tab.style.setProperty("left", `${a.value - at.offsetLeft}px`);
        }
      }

      if (animation.moving) {
        hasAnimation = true;
        const dir = getDir(animation.to, animation.from);
        clampMove(animation, speed * dir);
        dragTarget.style.setProperty("left", `${animation.value}px`);
      }

      if (animationExecuting || hasAnimation) {
        animationTimer = requestAnimationFrame(animationStep);
      } else {
        animationEnd();
      }
    }

    function animationStart() {
      animationExecuting = true;

      const {
        offsetLeft: x,
        offsetTop: y,
        offsetWidth: w,
        offsetHeight: h,
      } = dragTarget;

      for (let i = 0; i < animationTabs.length; i++) {
        const at = animationTabs[i];
        const { element: tab, animation: a } = at;
        tab.style.setProperty("position", "relative");
        tab.style.setProperty("left", `${a.to - at.offsetLeft}px`);
      }

      // set tab absolute
      dragTarget.style.setProperty("position", "absolute");
      dragTarget.style.setProperty("z-index", "1000");
      dragTarget.style.setProperty("top", `${y + 2}px`);
      dragTarget.style.setProperty("left", `${animation.value}px`);

      // add holder to keep size of tab container, and move tab to position of the
      // holder when move tab to the last
      lastHolder = createElement(
        `<div style="display: inline-block; width: ${w}px; height: ${h}px;"></div>`
      );
      parent.appendChild(lastHolder);

      animationTimer = requestAnimationFrame(animationStep);
    }

    function animationEnd() {
      for (let i = 0; i < animationTabs.length; i++) {
        const at = animationTabs[i];
        const { element: tab } = at;
        tab.style.removeProperty("position");
        tab.style.removeProperty("left");
      }

      const moveToElement =
        moveTo < animationTabs.length
          ? animationTabs[moveTo].element
          : lastHolder;

      parent.insertBefore(dragTarget, moveToElement);
      dragTarget.style.removeProperty("position");
      dragTarget.style.removeProperty("z-index");
      dragTarget.style.removeProperty("top");
      dragTarget.style.removeProperty("left");

      lastHolder.remove();
    }

    function findDragTarget(target: HTMLElement) {
      if (!target) {
        console.error("Require drag target.");
        return;
      }
      if (target === container) {
        console.error("Must drag start from child element in container.");
        return;
      }
      while (target.parentElement !== container) {
        target = target.parentElement as HTMLElement;
        if (!target || target === document.body) {
          console.error("Can't start drag from out of the container.");
          return;
        }
      }
      return target;
    }

    const dragStart: DragStartEventHandler = (e) => {
      dragTarget = findDragTarget(e.target as HTMLElement) as HTMLElement;
      if (!dragTarget) {
        return;
      }

      const {
        offsetLeft: x,
        offsetTop: y,
        offsetWidth: w,
        offsetHeight: h,
      } = dragTarget;

      dragOffsetX = e.clientX - x;
      dragOffsetY = e.clientY - y;
      xMin = parent.offsetLeft;
      xMax = parent.offsetLeft + parent.offsetWidth - w;

      // save current window index
      const children = Array.from(container.children) as HTMLElement[];
      moveTo = children.indexOf(dragTarget);

      // clear animation tabs
      animationTabs.splice(0, animationTabs.length);

      // save tabs exclude current window
      for (let i = 0; i < children.length; i++) {
        if (i !== moveTo) {
          const child = children[i];
          const { offsetLeft, offsetWidth } = child;
          const isBefore = i < moveTo;
          const a = {
            from: offsetLeft,
            to: offsetLeft,
            value: offsetLeft,
            moving: false,
          };
          const at = {
            element: child,
            offsetLeft: isBefore ? offsetLeft : offsetLeft - w,
            offsetWidth,
            animation: a,
          };
          animationTabs.push(at);
        }
      }

      animation.from = x;
      animation.to = x;
      animation.value = animation.from;
      animation.moving = animation.to !== animation.value;

      animationStart();
    };

    const dragMove: MouseEventHandler = (e) => {
      if (!dragTarget) {
        return;
      }

      const { offsetWidth: w } = dragTarget;

      // move tab follow mouse
      const x = clamp(e.clientX - dragOffsetX, {
        min: xMin,
        max: xMax,
      });
      animation.to = x;
      animation.moving = animation.to !== animation.value;

      // compute next index
      let next = 0;
      for (let i = 0; i < animationTabs.length; i++) {
        const at = animationTabs[i];
        const x_i = at.animation.to;
        const w_i = at.offsetWidth;
        const xMid = x_i + w_i / 2;
        if (e.clientX < xMid) {
          break;
        }
        next = i + 1;
      }

      // move hole if index changed
      if (next !== moveTo) {
        // compute animation state for changed tabs
        if (next > moveTo) {
          for (let i = moveTo; i < next; i++) {
            const at = animationTabs[i];
            const a = at.animation;
            a.from = a.value;
            a.to = at.offsetLeft;
            a.moving = a.value !== a.to;
          }
        } else {
          for (let i = next; i < moveTo; i++) {
            const at = animationTabs[i];
            const a = at.animation;
            a.from = a.value;
            a.to = at.offsetLeft + w;
            a.moving = a.value !== a.to;
          }
        }

        // save next index
        moveTo = next;
      }
    };

    const dragEnd: MouseEventHandler = (e) => {
      if (!dragTarget) {
        return;
      }

      const children = Array.from(container.children) as HTMLElement[];

      const index = children.indexOf(dragTarget);
      if (index !== moveTo) {
        onEnd?.({ from: index, to: moveTo });
      }

      const x =
        moveTo < animationTabs.length
          ? animationTabs[moveTo].offsetLeft
          : lastHolder.offsetLeft;

      animation.to = x;
      animation.moving = animation.to !== animation.value;

      // mark animation to end, drain all running animations
      animationExecuting = false;
    };

    dragHandler(container, { dragStart, dragMove, dragEnd });
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
    // TODO: animation
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
  let originTarget: HTMLElement;
  let startDragTimeout: any;

  target.addEventListener("mousedown", (e) => {
    downX = e.clientX;
    downY = e.clientY;
    target.addEventListener("mouseup", handleMouseUp);
    originTarget = e.target as HTMLElement;
    // delay to start drag, in order to handle click event,
    // tab will animate move to mouse position after start drag
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
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    const e = { target: originTarget, clientX: downX, clientY: downY };
    dragStart?.(e);
  }

  function endDrag(e: MouseEvent) {
    dragging = false;
    dragMask.remove();
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    dragEnd?.(e);
  }

  function handleMouseMove(e: MouseEvent) {
    dragMove?.(e);
  }

  function handleMouseUp(e: MouseEvent) {
    if (!dragging) {
      clearTimeout(startDragTimeout);
      originTarget.click();
    } else {
      endDrag(e);
    }
  }
}

function lerp(t: number, min: number, max: number) {
  return min + (max - min) * t;
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
