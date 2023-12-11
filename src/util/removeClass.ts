export function removeClass(element: HTMLElement, className: string) {
  const _className = element.className.trim();
  if (_className) {
    const array = _className.split(" ");
    if (array.indexOf(className) >= 0) {
      const newClassName = array.filter((c: any) => c !== className).join(" ");
      element.className = newClassName;
    }
  }
}
