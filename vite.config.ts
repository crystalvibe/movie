import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
// import obfuscator from 'rollup-plugin-obfuscator';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    // Temporarily commenting out obfuscator to debug deployment
    // mode === 'production' && obfuscator({
    //   options: {
    //     compact: true,
    //     controlFlowFlattening: true,
    //     controlFlowFlatteningThreshold: 1,
    //     deadCodeInjection: true,
    //     deadCodeInjectionThreshold: 1,
    //     debugProtection: true,
    //     debugProtectionInterval: 4000,
    //     disableConsoleOutput: true,
    //     identifierNamesGenerator: 'hexadecimal',
    //     log: false,
    //     numbersToExpressions: true,
    //     renameGlobals: false,
    //     rotateStringArray: true,
    //     selfDefending: true,
    //     shuffleStringArray: true,
    //     splitStrings: true,
    //     splitStringsChunkLength: 10,
    //     stringArray: true,
    //     stringArrayEncoding: ['base64'],
    //     stringArrayThreshold: 1,
    //     transformObjectKeys: true,
    //     unicodeEscapeSequence: false
    //   }
    // })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Performance optimizations
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['lucide-react'],
        },
      },
    },
    // Reduce bundle size
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
}));
