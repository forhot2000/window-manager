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

type TabDragEventHandlers = {
  onEnd(result: { from: number; to: number }): void;
};

export function tabDragHandler(
  container: HTMLElement,
  events: TabDragEventHandlers
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
