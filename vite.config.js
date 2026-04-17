import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import compressPlugin from 'vite-plugin-compression'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  
  return {
    plugins: [
      vue(),
      visualizer({
        open: false,
        filename: 'dist/stats.html'
      }),
      compressPlugin({
        algorithm: 'gzip',
        threshold: 10240,
        minRatio: 0.8
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:30000',
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      port: parseInt(env.VITE_PREVIEW_PORT) || 9090
    },
    build: {
      outDir: 'vue-dist',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            if (id.includes('src/components/')) {
              return 'components';
            }
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      }
    }
  }
})