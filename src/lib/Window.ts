import { addClass } from "../util/addClass";
import { removeClass } from "../util/removeClass";

export class Window {
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
