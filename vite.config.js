import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import { resolve } from "path";

export default defineConfig({
  plugins: [glsl()],
  root: ".",
  server: {
    open: "/Frontend/prc-engine/login.html",
    watch: {
      ignored: ["**/public/canvas1/**"],
    },
    proxy: {
      "/auth": "http://localhost:8000",
      "/search": "http://localhost:8000",
      "/profile": "http://localhost:8000",
    },
  },
  publicDir: "Frontend/public",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "Frontend/prc-engine/login.html"),
        signup: resolve(__dirname, "Frontend/prc-engine/signup.html"),
        dashboard: resolve(__dirname, "Frontend/prc-engine/index.html"),
      },
    },
  },
});