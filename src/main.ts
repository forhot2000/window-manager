import { WindowManager } from "./lib/window-manager";

const windowManager = new WindowManager();

// register your handlers
windowManager.registerHandlers({
  // your handlers
});

// handler click event for close all button
document.getElementById("close_all_tabs")?.addEventListener("click", (e) => {
  windowManager.closeAllWindows();
});

// open first fixed window
windowManager.openWindow("/page1.html", {
  id: "tab1",
  fixed: true,
});

// open second window in background
windowManager.openWindow("/page2.html", {
  id: "tab2",
  inBackground: true,
});

// open third window in background with external url
windowManager.openWindow(externalUrl("http://localhost:3001/page3.html"), {
  id: "tab3",
  inBackground: true,
});

// replace localhost:3001, it is useful on codesandbox.io
function externalUrl(url: string) {
  if (origin === "http://localhost:3000") {
    return url;
  }
  const uri = new URL(url, origin);
  if (uri.origin === origin) {
    return url;
  }
  const port = uri.port.toString();
  const newOrigin = origin.replace("3000", port);
  return url.replace(uri.origin, newOrigin);
}

// replace links
document.querySelectorAll("a").forEach((link) => {
  link.href = externalUrl(link.href);
});
