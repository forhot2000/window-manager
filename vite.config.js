import { glob } from "glob";
import { resolve } from "path";
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
    // lib: {
    //   entry: resolve(__dirname, "src/lib/Framework.ts"),
    //   name: "Framework",
    //   fileName: "framework",
    // },
    rollupOptions: {
      input: input,
    },
  },
  appType: "mpa",
});
