import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // amazon-chime-sdk-jsがNode.jsのglobalを参照するが、Viteはデフォルトでポリフィルしないため定義する
  define: {
    global: "globalThis",
  },
  server: {
    port: 5173,
  },
});
