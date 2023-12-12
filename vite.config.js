import { globSync } from "glob";
import { defineConfig } from "vite";

const input = Object.fromEntries(
  globSync("*.html").map((file) => {
    const name = file.substring(0, file.length - ".html".length);
    return [name, file];
  })
);

export default defineConfig({
  build: {
    rollupOptions: {
      input: input,
    },
  },
  appType: "mpa",
});
