import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/dashboard/', // Khóa cứng tiền tố đường dẫn tài nguyên trùng khớp với Route của Express [1]
  publicDir: false,    // Tắt tính năng quét tĩnh để giải quyết cảnh báo xung đột thư mục public
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'public', // Vite build xuất bản phẩm thẳng vào thư mục public của Express
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:54321',
      '/health': 'http://localhost:54321',
    },
  },
});