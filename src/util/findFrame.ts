import { HTMLWindow } from "./interfaces";


export function findFrame(childWindow: HTMLWindow) {
  let frame;
  const frames = document.querySelectorAll("iframe");
  for (const _frame of frames) {
    if (_frame.contentWindow === childWindow) {
      frame = _frame;
    }
  }
  return frame;
}
