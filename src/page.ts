import { Framework } from "./lib/framework";

const framework = new Framework({
  targetOrigin: "*",
});

const page_title = document.getElementById("page_title");
if (page_title) {
  try {
    // throw error if cross-domain
    parent.origin;
  } catch (err) {
    page_title.innerText = `${page_title.innerText} - ${origin}`;
  }
}

const btn_send = document.getElementById("btn_send");
if (btn_send) {
  btn_send.addEventListener("click", async function () {
    try {
      const windows = await framework.listWindows();
      log.debug("all windows:", windows);
    } catch (err) {
      log.error(err);
    }
  });
}

const btn_close = document.getElementById("btn_close");
if (btn_close) {
  btn_close.addEventListener("click", function () {
    framework.closeWindow();
  });
}

const btn_invalid = document.getElementById("btn_invalid");
if (btn_invalid) {
  btn_invalid.addEventListener("click", async function () {
    try {
      await framework.sendMessage({ command: "XXX" });
    } catch (err) {
      log.error(err);
    }
  });
}

const btn_clear = document.getElementById("btn_clear");
if (btn_clear) {
  btn_clear.addEventListener("click", async function () {
    log.clear();
  });
}

const output = document.getElementById("output");
const log = {
  debug(...args: any[]) {
    console.log(...args);
    if (output) {
      const d = document.createElement("div");
      d.innerText = `${args.join(" ")}`;
      output.appendChild(d);
    }
  },
  error(err: any) {
    console.error(err);
    if (output) {
      const d = document.createElement("div");
      d.style.setProperty("color", "rgb(212 15 15)");
      d.innerText = `${err}`;
      output.appendChild(d);
    }
  },
  clear() {
    console.clear();
    if (output) {
      const children = Array.from(output.children);
      children.forEach((c) => c.remove());
    }
  },
};
