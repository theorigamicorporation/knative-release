// See: https://rollupjs.org/introduction/

import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      exportConditions: ['node'],
      preferBuiltins: true
    }),
    commonjs(),
    json(),
    typescript()
  ],
  external: ['react']
})
