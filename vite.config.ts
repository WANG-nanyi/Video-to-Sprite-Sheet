import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 标准 Vite + React 配置
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  // 由于 index.html 就在根目录，Vite 会自动将其作为项目入口
});