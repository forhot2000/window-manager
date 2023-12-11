export function isLinkElement(target: HTMLElement): target is HTMLLinkElement {
  return target.nodeName === "A";
}
