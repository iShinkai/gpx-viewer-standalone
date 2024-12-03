import { defineConfig } from 'vite'
import terser from '@rollup/plugin-terser'
import esbuild from 'rollup-plugin-esbuild'

export default defineConfig(({ mode }) => {
  // ビルド設定
  const config = {
    build: {
      rollupOptions: {
        input: 'src/main.js',
        output: {
          format: 'iife',
          dir: `dist/`,
          entryFileNames: 'main.js',
        },
      },
      emptyOutDir: false,
    },
    plugins: [terser(), esbuild()],
  }

  // プロダクションビルド時は console を落とす
  if (mode === 'production') {
    config.plugins.push(
      terser({
        compress: {
          drop_console: true,
        },
      }),
    )
  }

  return config
})
