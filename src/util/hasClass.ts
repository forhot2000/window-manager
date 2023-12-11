export function hasClass(element: HTMLElement, className: string) {
  const _className = element.className.trim();
  if (!_className) {
    return false;
  }
  const array = _className.split(" ");
  return array.indexOf(className) >= 0;
}
