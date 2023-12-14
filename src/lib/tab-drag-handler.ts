type MouseEventHandler = (e: MouseEvent) => void;

type DragStartEventHandler = (
  e: Pick<MouseEvent, "target" | "clientX" | "clientY">
) => void;

type DragEventHandlers = {
  dragStart?: DragStartEventHandler;
  dragMove?: MouseEventHandler;
  dragEnd?: MouseEventHandler;
};

function dragHandler(container: HTMLElement, events: DragEventHandlers) {
  const { dragStart, dragMove, dragEnd } = events;

  let dragging = false;
  let dragMask: HTMLElement;
  let downX = 0;
  let downY = 0;
  let target: HTMLElement;
  let startDragTimeout: any;

  container.addEventListener("mousedown", (e) => {
    downX = e.clientX;
    downY = e.clientY;
    container.addEventListener("mouseup", handleMouseUp);
    target = e.target as HTMLElement;
    // delay to start drag, in order to handle click event,
    // tab will smooth move to mouse position after start drag
    startDragTimeout = setTimeout(startDrag, 200);
  });

  function startDrag() {
    dragging = true;
    // add layer over all sub windows
    dragMask = createElement(
      `<div style="position: absolute; top: 0; bottom: 0; left: 0; right: 0; background-color: #00000000; z-index: 9999;"></div>`
    );
    document.body.appendChild(dragMask);
    container.removeEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    const e = { target, clientX: downX, clientY: downY };
    try {
      dragStart?.(e);
    } catch (err) {
      console.error("drag start failed.\n%O", err);
    }
  }

  function endDrag(e: MouseEvent) {
    dragging = false;
    dragMask.remove();
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    try {
      dragEnd?.(e);
    } catch (err) {
      console.error("drag end failed.\n%O", err);
    }
  }

  function handleMouseMove(e: MouseEvent) {
    try {
      dragMove?.(e);
    } catch (err) {
      console.error("drag move failed.\n%O", err);
    }
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

type AnimationRender = (value: number, target: HTMLElement) => void;

const renders: { [k: string]: AnimationRender } = {};

["left", "top", "right", "bottom", "width", "height"].forEach((p) => {
  renders[p] = (v, el) => el.style.setProperty(p, `${v}px`);
});

type Animation = {
  from: number;
  to: number;
  value: number;
  moving: boolean;
  target: HTMLElement;
  render: string | AnimationRender;
};

class AnimationExecutor {
  stop: () => void;

  constructor(opts: {
    animations: Animation[];
    animationStart(): void;
    animationEnd(): void;
  }) {
    const { animations, animationStart, animationEnd } = opts;
    const speed = 8;
    let draining = false;
    let timer: number;

    this.stop = () => {
      draining = true;
    };

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

    function step(timestamp: number) {
      let animating = false;
      try {
        for (let i = 0; i < animations.length; i++) {
          const a = animations[i];
          if (a.moving) {
            animating = true;
            const dir = getDir(a.to, a.from);
            clampMove(a, speed * dir);
            if (typeof a.render === "string") {
              renders[a.render](a.value, a.target);
            } else {
              a.render(a.value, a.target);
            }
          }
        }
      } catch (err) {
        console.error("animation step failed.%O", err);
        animationEnd();
        return;
      }

      if (!draining || animating) {
        timer = requestAnimationFrame(step);
      } else {
        animationEnd();
      }
    }

    try {
      animationStart();
    } catch (err) {
      console.error("start animation failed.%O", err);
      animationEnd();
      return;
    }

    timer = requestAnimationFrame(step);
  }
}

type AnimationTab = Animation & {
  offsetLeft: number;
  offsetWidth: number;
};

type TabDragEventHandlers = {
  onEnd(result: { from: number; to: number }): void;
};

export function tabDragHandler(
  container: HTMLElement,
  events: TabDragEventHandlers
) {
  const parent = container;
  const { onEnd } = events;
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

  let animationTabs: AnimationTab[];
  let animationDragTarget: Animation;
  let animationExecutor: AnimationExecutor;

  function animationStart() {
    const {
      offsetLeft: x,
      offsetTop: y,
      offsetWidth: w,
      offsetHeight: h,
    } = dragTarget;

    for (let i = 0; i < animationTabs.length; i++) {
      const a = animationTabs[i];
      const { target: tab } = a;
      tab.style.setProperty("position", "relative");
      tab.style.setProperty("left", `${a.value}px`);
    }

    // set dragging tab absolute
    dragTarget.style.setProperty("position", "absolute");
    dragTarget.style.setProperty("z-index", "1000");
    dragTarget.style.setProperty("top", `${y + 2}px`);
    dragTarget.style.setProperty("left", `${animationDragTarget.value}px`);

    // add holder to keep size of tab container, and move tab to position of the
    // holder when move tab to the last
    lastHolder = createElement(
      `<div style="display: inline-block; width: ${w}px; height: ${h}px;"></div>`
    );
    parent.appendChild(lastHolder);
  }

  function animationEnd() {
    for (let i = 0; i < animationTabs.length; i++) {
      const a = animationTabs[i];
      const { target: tab } = a;
      tab.style.removeProperty("position");
      tab.style.removeProperty("left");
    }

    dragTarget.style.removeProperty("position");
    dragTarget.style.removeProperty("z-index");
    dragTarget.style.removeProperty("top");
    dragTarget.style.removeProperty("left");

    try {
      const moveToElement =
        moveTo < animationTabs.length
          ? animationTabs[moveTo].target
          : lastHolder;
      parent.insertBefore(dragTarget, moveToElement);
    } catch (err) {
      console.error("move target failed.\n%O", err);
      // state maybe already changed, render with new state
    }

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

    // save tabs exclude current window
    animationTabs = [];
    for (let i = 0; i < children.length; i++) {
      if (i !== moveTo) {
        const child = children[i];
        const isBefore = i < moveTo;
        const value = isBefore ? 0 : w;
        const offsetLeft = child.offsetLeft - value;
        const offsetWidth = child.offsetWidth;
        // relative
        animationTabs.push({
          from: value,
          to: value,
          value: value,
          moving: false,
          target: child,
          render: "left",
          offsetLeft,
          offsetWidth,
        });
      }
    }

    // absolute
    animationDragTarget = {
      from: x,
      to: x,
      value: x,
      moving: false,
      target: dragTarget,
      render: "left",
    };

    // start animation executor
    animationExecutor = new AnimationExecutor({
      animations: [animationDragTarget, ...animationTabs],
      animationStart,
      animationEnd,
    });
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
    animationDragTarget.to = x;
    animationDragTarget.moving =
      animationDragTarget.to !== animationDragTarget.value;

    // compute next index
    let next = 0;
    for (let i = 0; i < animationTabs.length; i++) {
      const a = animationTabs[i];
      const x_i = a.to + a.offsetLeft;
      const w_i = a.offsetWidth;
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
          const a = animationTabs[i];
          a.from = a.value;
          a.to = 0;
          a.moving = a.value !== a.to;
        }
      } else {
        for (let i = next; i < moveTo; i++) {
          const a = animationTabs[i];
          a.from = a.value;
          a.to = w;
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

    animationDragTarget.to = x;
    animationDragTarget.moving =
      animationDragTarget.to !== animationDragTarget.value;

    // mark animation to end, drain all running animations
    animationExecutor.stop();
  };

  dragHandler(container, { dragStart, dragMove, dragEnd });
}

function lerp(t: number, min: number, max: number) {
  return min + (max - min) * t;
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
