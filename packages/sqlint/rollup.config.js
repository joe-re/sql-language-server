import typescript from '@rollup/plugin-typescript'
import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json"
import resolve from '@rollup/plugin-node-resolve'

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    typescript(),
    json(),
    resolve({ preferBuiltins: false }),
    commonjs()
  ]
}