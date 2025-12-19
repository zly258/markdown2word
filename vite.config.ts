import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // 使用相对路径以兼容 Electron 和浏览器扩展
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // 将限制提高到 1000kB 以抑制桌面应用的警告
  },
  server: {
    port: 5173
  }
});