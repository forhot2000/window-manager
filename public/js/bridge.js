(function () {
  let windowIdSeed = 1;
  function nextWindowId() {
    return "c" + windowIdSeed++;
  }

  function clamp(value, { min = 0, max = 1 }) {
    return value < min ? min : value > max ? max : value;
  }

  function hasClass(element, className) {
    const _className = element.className.trim();
    if (!_className) {
      return false;
    }
    const array = _className.split(" ");
    return array.indexOf(className) >= 0;
  }

  function addClass(element, className) {
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

  function removeClass(element, className) {
    const _className = element.className.trim();
    if (_className) {
      const array = _className.split(" ");
      if (array.indexOf(className) >= 0) {
        const newClassName = array.filter((c) => c !== className).join(" ");
        element.className = newClassName;
      }
    }
  }

  function createElement(html) {
    let temp = document.createElement("template");
    html = html.trim(); // Never return a space text node as a result
    temp.innerHTML = html;
    return temp.content.firstChild;
  }

  function findFrame(childWindow) {
    let frame;
    const frames = document.querySelectorAll("iframe");
    for (const _frame of frames) {
      if (_frame.contentWindow === childWindow) {
        frame = _frame;
      }
    }
    return frame;
  }

  class Window {
    constructor(props) {
      Object.assign(this, props);
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

  class WindowManager {
    constructor() {
      this.windows = new Map();
      this.activeWindowId = null;

      document.addEventListener("click", this.onClick.bind(this));

      this.tabContainer = document.querySelector(".wd-tab-container");
      this.windowContainer = document.querySelector(".wd-panel-container");
      this.closeAllButton = document.getElementById("close_all_tabs");

      this.loadWindows();

      if (this.closeAllButton) {
        this.closeAllButton.addEventListener("click", () => {
          this.closeAllWindows();
        });
      }

      if (!this.activeWindowId && this.windows.size > 0) {
        this.focusAt(0);
      }
    }

    getWindow(id) {
      return this.windows.get(id);
    }

    getWindowAt(index) {
      let i = 0;
      for (const _window of this.windows.values()) {
        if (i === index) {
          return _window;
        }
        i++;
      }
      return null;
    }

    listWindows() {
      return Array.from(this.windows.keys());
    }

    findIndex(id) {
      let i = 0;
      for (const key of this.windows.keys()) {
        if (key === id) {
          return i;
        }
        i++;
      }
      return -1;
    }

    findWindowByFrame(frame) {
      for (const _window of this.windows.values()) {
        if (_window.frame === frame) {
          return _window;
        }
      }
      return null;
    }

    createWindow({ id, title, href }) {
      const tab = createElement(`
        <div class="wd-tab" data-tab="${id}" data-role="window-tab">
          <span>${title}</span>
          <span class="close" title="close this window">X</span>
        </div>`);
      this.tabContainer.appendChild(tab);

      const panel = createElement(`
        <div id="${id}" class="wd-panel" data-role="window-panel">
          <iframe src="${href}" frameborder="0"></iframe>
        </div>`);
      this.windowContainer.appendChild(panel);

      const frame = panel.querySelector("iframe");
      const closeButton = tab.querySelector(".close");
      const fixed = false;

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
        state: "init",
      });
      return _window;
    }

    closeWindow(id) {
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

    loadWindows() {
      const tabs = this.tabContainer.querySelectorAll(
        '[data-role="window-tab"]'
      );
      tabs.forEach((tab) => {
        const id = tab.getAttribute("data-tab");
        const panel = this.windowContainer.querySelector(
          `#${id}[data-role="window-panel"]`
        );
        const frame = panel.querySelector("iframe");
        const closeButton = tab.querySelector(".close");
        const fixed = tab.getAttribute("data-fixed");
        const focused = hasClass(tab, "active");

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
          state: "init",
        });

        this.windows.set(id, _window);
        if (focused) {
          if (this.activeWindowId) {
            console.warn(
              `can't active tab '${id}', only allow one active tab!`
            );
            _window.blur();
          } else {
            _window.focus();
            this.activeWindowId = _window.id;
          }
        } else {
          _window.blur();
        }
      });
      console.log(this.windows);
    }

    registerWindow(child) {
      // console.log("register window: %s %O", id, window);
      const frame = findFrame(child);
      let _window = this.findWindowByFrame(frame);
      if (!_window) {
        throw new Error("window not found.");
      }
      _window.state = "ready";
      return _window.id;
    }

    focus(id) {
      const _window = this.getWindow(id);
      this.focusWindow(_window);
    }

    focusAt(index) {
      const _window = this.getWindowAt(index);
      this.focusWindow(_window);
    }

    focusWindow(_window) {
      if (!_window) {
        throw new Error("window not found.");
      }
      const lastWindow = this.getActiveWindow();
      if (lastWindow) {
        lastWindow.blur();
      }
      _window.focus();
      this.activeWindowId = _window.id;
    }

    getActiveWindow() {
      return this.activeWindowId ? this.getWindow(this.activeWindowId) : null;
    }

    onClick(e) {
      if (e.target.nodeName === "A") {
        const link = e.target;
        const id = link.getAttribute("data-tab");
        if (id) {
          e.preventDefault();
          const href = link.href;
          const title =
            link.getAttribute("data-title") || link.innerText.trim();
          this.openWindow(href, { id, title });
        }
      }
    }

    openWindow(href, { id, title }) {
      console.log(`open '${href}' in window '${id}'`);
      const _window = this.getWindow(id);
      if (!_window) {
        this.windows.set(id, this.createWindow({ id, title, href }));
      }
      this.focus(id);
    }
  }

  class Bridge {
    constructor({ windowManager }) {
      this.windowManager = windowManager;
      this.handlers = {
        registerWindow: (_, child) => this.windowManager.registerWindow(child),
        listWindows: () => this.windowManager.listWindows(),
        closeWindow: (id) => this.windowManager.closeWindow(id),
      };

      window.addEventListener("message", this.onMessage.bind(this));
    }

    onMessage({ data, origin, source }) {
      // console.log("parent received: %O %O %O", data, origin, source);
      const { id, command, args } = data;
      if (!id || !command) {
        return;
      }
      const handler = this.handlers[command];
      if (!handler) {
        const error = `invalid command '${command}'`;
        source.postMessage({ id, error }, { targetOrigin: origin });
        return;
      }
      try {
        const result = handler(args, source);
        source.postMessage({ id, result }, { targetOrigin: origin });
      } catch (err) {
        source.postMessage(
          { id, error: err.message },
          { targetOrigin: origin }
        );
      }
    }
  }

  window.Bridge = Bridge;
  window.WindowManager = WindowManager;
})();
