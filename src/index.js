import { createServer } from "vite";
import httpProxy from "http-proxy";

async function main() {
  httpProxy.createProxyServer({ target: "http://localhost:3000" }).listen(3001);

  const server = await createServer({
    // any valid user config options, plus `mode` and `configFile`
    configFile: "vite.config.js",
    root: process.cwd(),
  });
  await server.listen();

  server.printUrls();
  server.bindCLIShortcuts({ print: true });
}

main();
