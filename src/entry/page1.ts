import { Framework } from "../lib/Framework";

const framework = new Framework();

const btn_send = document.getElementById("btn_send");
if (btn_send) {
  btn_send.addEventListener("click", async function () {
    try {
      const windows = await framework.listWindows();
      console.log("all windows: %O", windows);
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
