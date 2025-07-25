import path from 'path'
import {
  defineConfig,
  HttpProxy,
  PluginOption,
  splitVendorChunkPlugin,
  type ConfigEnv,
  type UserConfig,
} from 'vite'
import react from '@vitejs/plugin-react'
import nodeResolve from '@rollup/plugin-node-resolve'
import postcss from './postcss.config'
import checker from 'vite-plugin-checker'

// https://vitejs.dev/config/
export default defineConfig(
  async ({ command }: ConfigEnv): Promise<UserConfig> => {
    const mdx = await import('@mdx-js/rollup').then(r => r.default)
    const rehypeHighlight = await import('rehype-highlight').then(
      r => r.default
    )

    const plugins = [
      react(),
      mdx({ rehypePlugins: [rehypeHighlight], remarkPlugins: [] }),
      nodeResolve(),
      splitVendorChunkPlugin(),
      command === 'build' ? checker({ typescript: true }) : undefined,
    ].filter(Boolean) as PluginOption[]

    return {
      define: {
        'process.env.GIT_COMMIT': JSON.stringify(process.env.GIT_COMMIT),
      },
      plugins,
      css: {
        postcss,
      },
      server: {
        host: process.env.VITE_HOST === 'true' ? true : process.env.VITE_HOST,
        port: 3000,
        proxy: {
          '^/(api|health-check).*': {
            target: `http://localhost:3001`,
            changeOrigin: true,
            configure: configureProxy,
          },
          '^/websocket': {
            target: 'ws://localhost:3002',
            changeOrigin: true,
            configure: configureProxy,
          },
        },
        watch: {
          // prevent hot reloading when backend files change
          ignored: ['**/src/server/**/*.ts', '**/env.ts', '**/entry.ts'],
        },
      },
      resolve: {
        alias: [
          { find: 'node-fetch', replacement: 'cross-fetch' },
          { find: '~', replacement: path.resolve(__dirname, './src') },
          { find: 'src', replacement: path.resolve(__dirname, './src') },
          { find: 'env', replacement: path.resolve(__dirname, './env') },
        ],
      },
      build: {
        outDir: 'dist/client',
        assetsDir: 'app-assets',
      },
    }
  }
)

function configureProxy(proxy: HttpProxy.Server) {
  proxy.removeAllListeners('error')

  proxy.on('error', err => {
    // experimental: silence ECONNREFUSED errors when Vite is ready but the backend hasn't started yet
    if (err.message.includes('ECONNREFUSED 127.0.0.1')) {
      return
    }
    console.error(err)
  })
}
