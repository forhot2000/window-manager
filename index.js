const handler = require("serve-handler");
const http = require("http");

function site1() {
  const server = http.createServer((request, response) => {
    // You pass two more arguments for config and middleware
    // More details here: https://github.com/vercel/serve-handler#options
    return handler(request, response, { public: "public" });
  });

  server.listen(3000, () => {
    console.log("Running at http://localhost:3000");
  });
}

function site2() {
  const server = http.createServer((request, response) => {
    // You pass two more arguments for config and middleware
    // More details here: https://github.com/vercel/serve-handler#options
    return handler(request, response, { public: "public" });
  });

  server.listen(3001, () => {
    console.log("Running at http://localhost:3001");
  });
}

function main() {
  site1();
  site2();
}

main();
