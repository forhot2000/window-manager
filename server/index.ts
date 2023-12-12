import express, { RequestHandler } from "express";
import httpProxy from "http-proxy";
import Bundler from "parcel-bundler";

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

function slowRequest(handler: RequestHandler, delay: number): RequestHandler {
  return (req, res, next) => {
    setTimeout(() => {
      handler(req, res, next);
    }, delay);
  };
}

async function createServer() {
  const app = express();

  app.use("/test.js", testJs);

  app.use(express.static("public"));

  const bundler = setupBundler();

  // Let express use the bundler middleware, this will let Parcel handle every request over your express server
  app.use(bundler.middleware());

  app.listen(3000, function () {
    console.log("app listen on http://localhost:3000");
  });
}

function setupBundler() {
  const file = "index.html"; // Pass an absolute path to the entrypoint here
  const options = {}; // See options section of api docs, for the possibilities

  // Initialize a new bundler using a file and options
  const bundler = new Bundler(file, options);
  return bundler;
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
