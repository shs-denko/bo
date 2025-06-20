// vite.config.ts
import { defineConfig } from "file:///C:/Users/%E6%B8%85%E6%B0%B4%E8%B0%B7DXPC_No.1/Desktop/bo/node_modules/vite/dist/node/index.js";
import solid from "file:///C:/Users/%E6%B8%85%E6%B0%B4%E8%B0%B7DXPC_No.1/Desktop/bo/node_modules/vite-plugin-solid/dist/esm/index.mjs";
var host = process.env.TAURI_DEV_HOST;
var vite_config_default = defineConfig(async () => ({
  plugins: [solid()],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? {
      protocol: "ws",
      host,
      port: 1421
    } : void 0,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"]
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlUm9vdCI6ICJDOlxcVXNlcnNcXFx1NkUwNVx1NkMzNFx1OEMzN0RYUENfTm8uMVxcRGVza3RvcFxcYm9cXCIsCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcXHU2RTA1XHU2QzM0XHU4QzM3RFhQQ19Oby4xXFxcXERlc2t0b3BcXFxcYm9cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXFx1NkUwNVx1NkMzNFx1OEMzN0RYUENfTm8uMVxcXFxEZXNrdG9wXFxcXGJvXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy8lRTYlQjglODUlRTYlQjAlQjQlRTglQjAlQjdEWFBDX05vLjEvRGVza3RvcC9iby92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCBzb2xpZCBmcm9tIFwidml0ZS1wbHVnaW4tc29saWRcIjtcclxuXHJcbi8vIEB0cy1leHBlY3QtZXJyb3IgcHJvY2VzcyBpcyBhIG5vZGVqcyBnbG9iYWxcclxuY29uc3QgaG9zdCA9IHByb2Nlc3MuZW52LlRBVVJJX0RFVl9IT1NUO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKGFzeW5jICgpID0+ICh7XHJcbiAgcGx1Z2luczogW3NvbGlkKCldLFxyXG5cclxuICAvLyBWaXRlIG9wdGlvbnMgdGFpbG9yZWQgZm9yIFRhdXJpIGRldmVsb3BtZW50IGFuZCBvbmx5IGFwcGxpZWQgaW4gYHRhdXJpIGRldmAgb3IgYHRhdXJpIGJ1aWxkYFxyXG4gIC8vXHJcbiAgLy8gMS4gcHJldmVudCB2aXRlIGZyb20gb2JzY3VyaW5nIHJ1c3QgZXJyb3JzXHJcbiAgY2xlYXJTY3JlZW46IGZhbHNlLFxyXG4gIC8vIDIuIHRhdXJpIGV4cGVjdHMgYSBmaXhlZCBwb3J0LCBmYWlsIGlmIHRoYXQgcG9ydCBpcyBub3QgYXZhaWxhYmxlXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiAxNDIwLFxyXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSxcclxuICAgIGhvc3Q6IGhvc3QgfHwgZmFsc2UsXHJcbiAgICBobXI6IGhvc3RcclxuICAgICAgPyB7XHJcbiAgICAgICAgICBwcm90b2NvbDogXCJ3c1wiLFxyXG4gICAgICAgICAgaG9zdCxcclxuICAgICAgICAgIHBvcnQ6IDE0MjEsXHJcbiAgICAgICAgfVxyXG4gICAgICA6IHVuZGVmaW5lZCxcclxuICAgIHdhdGNoOiB7XHJcbiAgICAgIC8vIDMuIHRlbGwgdml0ZSB0byBpZ25vcmUgd2F0Y2hpbmcgYHNyYy10YXVyaWBcclxuICAgICAgaWdub3JlZDogW1wiKiovc3JjLXRhdXJpLyoqXCJdLFxyXG4gICAgfSxcclxuICB9LFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1QsU0FBUyxvQkFBb0I7QUFDalYsT0FBTyxXQUFXO0FBR2xCLElBQU0sT0FBTyxRQUFRLElBQUk7QUFHekIsSUFBTyxzQkFBUSxhQUFhLGFBQWE7QUFBQSxFQUN2QyxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLakIsYUFBYTtBQUFBO0FBQUEsRUFFYixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixNQUFNLFFBQVE7QUFBQSxJQUNkLEtBQUssT0FDRDtBQUFBLE1BQ0UsVUFBVTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLE1BQU07QUFBQSxJQUNSLElBQ0E7QUFBQSxJQUNKLE9BQU87QUFBQTtBQUFBLE1BRUwsU0FBUyxDQUFDLGlCQUFpQjtBQUFBLElBQzdCO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
