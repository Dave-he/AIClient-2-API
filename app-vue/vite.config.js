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
        '@': resolve(__dirname, 'src'),
        '@/utils/logger': resolve(__dirname, 'src/utils/logger.client.js')
      }
    },
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:30000',
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('Proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('Proxying:', req.method, req.url, '->', options.target + req.url);
            });
          }
        }
      }
    },
    preview: {
      port: parseInt(env.VITE_PREVIEW_PORT) || 9090
    },
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'element-plus',
        'axios',
        'vue-i18n'
      ]
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        output: {
          manualChunks(id) {
            // Vue and Vue Router
            if (id.includes('node_modules/vue/dist') || 
                id.includes('node_modules/@vue/runtime') || 
                id.includes('node_modules/vue-router')) {
              return 'vue-vendor';
            }
            
            // Element Plus
            if (id.includes('node_modules/element-plus')) {
              return 'element-plus';
            }
            
            // Axios and utilities
            if (id.includes('node_modules/axios')) {
              return 'axios';
            }
            
            // Other vendor libraries
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            
            // Composables
            if (id.includes('src/composables/')) {
              return 'composables';
            }
            
            // Components
            if (id.includes('src/components/')) {
              return 'components';
            }
            
            // Utils
            if (id.includes('src/utils/')) {
              return 'utils';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      chunkSizeWarningLimit: 1000,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          pure_funcs: mode === 'production' ? ['console.log', 'console.debug'] : []
        }
      },
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Enable rollup output sourcemap
      reportCompressedSize: false
    }
  }
})
