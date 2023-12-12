import { Bridge } from "./bridge";
import { HandlerOpts } from "./handler.interfaces";
import {
  clamp,
  createElement,
  findFrame,
  hasClass,
  isLinkElement,
} from "./util";
import { Window } from "./window";
import { HTMLWindow } from "./window.interfaces";

export class WindowManager {
  private windows: Map<string, Window>;
  private activeWindowId?: string;
  private tabContainer!: HTMLElement;
  private windowContainer!: HTMLElement;
  private closeAllButton!: HTMLElement;
  private bridge: Bridge;

  constructor() {
    this.windows = new Map();

    document.addEventListener("click", this.onClick.bind(this));

    this.tabContainer = document.querySelector(".window-tab-container")!;
    this.windowContainer = document.querySelector(".window-panel-container")!;
    this.closeAllButton = document.getElementById("close_all_tabs")!;

    this.loadWindows();

    if (this.closeAllButton) {
      this.closeAllButton.addEventListener("click", () => {
        this.closeAllWindows();
      });
    }

    if (!this.activeWindowId && this.windows.size > 0) {
      this.focusAt(0);
    }

    this.bridge = new Bridge({
      type: "window-manager",
      handlers: {
        registerWindow: (_, child) => this.registerWindow(child as HTMLWindow),
        listWindows: () => this.listWindows(),
        closeWindow: (id) => this.closeWindow(id),
      },
    });
  }

  private getWindow(id: string) {
    return this.windows.get(id);
  }

  private getWindowAt(index: number) {
    let i = 0;
    for (const _window of this.windows.values()) {
      if (i === index) {
        return _window;
      }
      i++;
    }
    return undefined;
  }

  listWindows() {
    return Array.from(this.windows.keys());
  }

  private findIndex(id: string) {
    let i = 0;
    for (const key of this.windows.keys()) {
      if (key === id) {
        return i;
      }
      i++;
    }
    return -1;
  }

  private findWindowByFrame(frame: HTMLElement) {
    for (const _window of this.windows.values()) {
      if (_window.frame === frame) {
        return _window;
      }
    }
    return undefined;
  }

  private createWindow(opts: { id: string; title: string; href: string }) {
    const { id, title, href } = opts;

    const tab = createElement(`
        <div class="window-tab" data-tab="${id}" data-role="window-tab">
          <span>${title}</span>
          <span class="close" title="close this window">X</span>
        </div>`);
    this.tabContainer!.appendChild(tab);

    const panel = createElement(`
        <div id="${id}" class="window-panel" data-role="window-panel">
          <iframe src="${href}" frameborder="0"></iframe>
        </div>`);
    this.windowContainer!.appendChild(panel);

    const frame = panel.querySelector("iframe")!;
    const closeButton = tab.querySelector(".close")!;
    const fixed = false;

    tab.addEventListener("click", (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      this.focus(id);
    });

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          this.closeWindow(id);
        }
      );
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
    const _window = this.getWindow(id);
    const index = this.findIndex(id);
    if (!_window) {
      throw new Error("window not found.");
    }
    if (_window.fixed) {
      throw new Error("can't close fixed tab!");
    }
    _window.close();
    this.windows.delete(id);
    this.focusAt(clamp(index, { max: this.windows.size - 1 }));
  }

  closeAllWindows() {
    const windows = this.listWindows();
    for (const _window of windows) {
      try {
        this.closeWindow(_window);
      } catch (err) {}
    }
  }

  private loadWindows() {
    const tabs = this.tabContainer.querySelectorAll<HTMLElement>(
      '[data-role="window-tab"]'
    );
    tabs.forEach((tab) => {
      const id = tab.getAttribute("data-tab");
      if (!id) {
        console.error("require attribute 'data-tab'!");
        return;
      }

      const panel = this.windowContainer.querySelector<HTMLElement>(
        `#${id}[data-role="window-panel"]`
      )!;
      const frame = panel.querySelector("iframe")!;
      const closeButton = tab.querySelector(".close");
      const fixed = tab.getAttribute("data-fixed") === "true";
      const focused = hasClass(tab, "active");

      tab.addEventListener("click", (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        this.focus(id);
      });

      if (closeButton) {
        closeButton.addEventListener(
          "click",
          (e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            this.closeWindow(id);
          }
        );
      }

      const _window = new Window({
        id,
        tab,
        panel,
        frame,
        fixed,
      });

      this.windows.set(id, _window);
      if (focused) {
        if (this.activeWindowId) {
          console.warn(`can't active tab '${id}', only allow one active tab!`);
          _window.blur();
        } else {
          _window.focus();
          this.activeWindowId = _window.id;
        }
      } else {
        _window.blur();
      }
    });
    // console.log(this.windows);
  }

  private registerWindow(child: HTMLWindow) {
    // console.log("register window: %s %O", id, window);
    const frame = findFrame(child)!;
    let _window = this.findWindowByFrame(frame);
    if (!_window) {
      throw new Error("window not found.");
    }
    _window.state = "ready";
    return _window.id;
  }

  focus(id: string) {
    const _window = this.getWindow(id);
    if (!_window) {
      throw new Error("window not found.");
    }
    this.focusWindow(_window);
  }

  focusAt(index: number) {
    const _window = this.getWindowAt(index);
    if (!_window) {
      throw new Error("window not found.");
    }
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
      ? this.getWindow(this.activeWindowId)
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

  private openWindow(href: string, opts: { id: string; title: string }) {
    const { id, title } = opts;
    console.log(`open '${href}' in window '${id}'`);
    const _window = this.getWindow(id);
    if (!_window) {
      this.windows.set(id, this.createWindow({ id, title, href }));
    }
    this.focus(id);
  }

  registerHandlers(handlers: HandlerOpts) {
    this.bridge.registerHandlers(handlers);
  }
}
