import { createServer as createViteServer } from "vite";
import httpProxy from "http-proxy";
import express from "express";

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

async function createServer() {
  const app = express();

  const vite = await createViteServer({
    configFile: "vite.config.js",
    server: {
      middlewareMode: true,
    },
  });

  app.use(
    "/test.js",
    slowRequest(1000, function (req, res) {
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
    })
  );

  app.use(express.static("public"));

  app.use(vite.middlewares);

  app.listen(3000, function () {
    console.log("app listen on http://localhost:3000");
  });
}

main();
