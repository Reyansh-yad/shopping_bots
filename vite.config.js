import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import { resolve } from "path";

export default defineConfig({
  plugins: [glsl()],
  root: ".",
  server: {
    open: "/Frontend/src/pages/login.html",
    watch: {
      ignored: ["**/public/canvas1/**"],
    },
  },
  publicDir: "Frontend/public",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "Frontend/src/pages/login.html"),
        signup: resolve(__dirname, "Frontend/src/pages/signup.html"),
        dashboard: resolve(__dirname, "Frontend/src/pages/dashboard.html"),
        "price-tracking": resolve(__dirname, "Frontend/src/pages/price-tracking.html"),
      },
    },
  },
});
