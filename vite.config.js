import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    host: true,
    port: 5173,
  },
  test: {
    include: ["src/engine/**/*.test.js"],
  },
});
