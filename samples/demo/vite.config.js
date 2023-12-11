import { glob } from "glob";
import { defineConfig } from "vite";

const input = Object.fromEntries(
  glob
    .sync("*.html")
    .map((file) => [file.substring(0, file.length - ".html".length), file])
);
// console.log(input);

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      input: input,
    },
  },
  appType: "mpa",
});
