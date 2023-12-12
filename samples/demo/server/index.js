import express from "express";
import httpProxy from "http-proxy";
import { createServer as createViteServer } from "vite";

const MIME = { javascript: "application/javascript" };

async function main() {
  createProxy();
  await createServer();
}

function createProxy() {
  httpProxy
    .createProxyServer({
      target: "http://localhost:3000",
    })
    .listen(3001);
}

function slowRequest(delay, handler) {
  return (req, res) => {
    setTimeout(() => {
      handler(req, res);
    }, delay);
  };
}

const testJs = slowRequest(1000, function (req, res) {
  const { id = "1" } = req.query;
  res.contentType(MIME.javascript).send(`
    (function () {
      const id = "${id}";
      console.log(id);
      document.addEventListener("DOMContentLoaded", function () {
        console.log(id + "-ready");
      });
    })();
  `);
});

async function createServer() {
  const app = express();

  const vite = await setupVite();

  app.use("/test.js", testJs);

  app.use(express.static("public"));

  app.use(vite.middlewares);

  app.listen(3000, function () {
    console.log("app listen on http://localhost:3000");
  });
}

async function setupVite() {
  return await createViteServer({
    configFile: "vite.config.js",
    server: {
      middlewareMode: true,
    },
  });
}

main();
