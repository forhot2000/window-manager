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

function slowRequest(handler, delay) {
  return (req, res) => {
    setTimeout(() => {
      handler(req, res);
    }, delay);
  };
}

async function createServer() {
  const app = express();

  app.use("/test.js", testJs);

  app.use(express.static("public"));

  const vite = await setupVite();
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

const testJs = slowRequest(function (req, res) {
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
}, 1000);

main();
