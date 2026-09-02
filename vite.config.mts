import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules/xlsx')) return 'vendor-xlsx';
          if (id.includes('node_modules/docx')) return 'vendor-docx';
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas') || id.includes('node_modules/dompurify')) return 'vendor-pdf';
          if (id.includes('/src/core/') || id.includes('\\src\\core\\')) return 'mcdm-engine';
          if (id.includes('/src/services/') || id.includes('\\src\\services\\')) return 'mcdm-services';
          if (id.includes('/src/components/') || id.includes('\\src\\components\\')) return 'mcdm-ui';
        },
      },
    },
  },
});
