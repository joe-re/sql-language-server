import typescript from '@rollup/plugin-typescript';
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'index.ts',
  output: {
    dir: 'dist_index',
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    typescript({ tsconfig: 'tsconfig.index.json' }),
    json(),
    resolve({
      preferBuiltins: false
    }),
    replace({
      delimiters: ['', ''],
      values: {
        'require(\'readable-stream/transform\')': 'require(\'stream\').Transform',
        'require("readable-stream/transform")': 'require("stream").Transform',
        'readable-stream': 'stream'
      }
    }),
    commonjs({
      ignore: ['pg-native' , './native']
    })
  ]
};
