import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Giả lập __dirname theo chuẩn ES Module tương thích hoàn toàn với Node.js mới
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/dashboard/', // Khóa cứng tiền tố đường dẫn tài nguyên trùng khớp với Route của Express
  publicDir: false,    // Tắt tính năng quét tĩnh để giải quyết cảnh báo xung đột thư mục public
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Sửa lại đường dẫn tuyệt đối đảm bảo tương thích hoàn toàn trên môi trường Windows
    outDir: path.resolve(__dirname, '../bridge_server/public'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:54321', // Chuyển sang IPv4 tĩnh để ngăn lỗi treo phân giải socket
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: 'http://127.0.0.1:54321',
        changeOrigin: true,
      },
    },
  },
});