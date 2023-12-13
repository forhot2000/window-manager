import { Framework } from "./lib/framework";

const framework = new Framework({
  targetOrigin: "*",
});

const txt_origin = document.getElementById("txt_origin");
if (txt_origin) {
  try {
    // throw error if cross-domain
    parent.origin;
  } catch (err) {
    txt_origin.innerText = origin;
  }
}

const btn_send = document.getElementById("btn_send");
if (btn_send) {
  btn_send.addEventListener("click", async function () {
    try {
      const windows = await framework.listWindows();
      console.log("all windows: %s", windows);
    } catch (err) {
      console.error(err);
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
      console.error(err);
    }
  });
}
