import typescript from '@rollup/plugin-typescript';
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";


export default {
  input: 'bin/cli.ts',
  output: {
    banner: "#! /usr/bin/env node",
    dir: 'dist',
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    typescript(),
    json(),
    replace({
      delimiters: ['', ''],
      values: {
        'require(\'readable-stream/transform\')': 'require(\'stream\').Transform',
        'require("readable-stream/transform")': 'require("stream").Transform',
        'readable-stream': 'stream'
      }
    }),
    commonjs({
      include: ["node_modules/**/*", "../../node_modules/**/*"]
    })
  ]
};
