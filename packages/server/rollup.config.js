import typescript from '@rollup/plugin-typescript';
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'bin/cli.ts',
  output: {
    banner: "#! /usr/bin/env node",
    dir: 'dist',
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    typescript({ tsconfig: 'tsconfig.cli.json', noEmitOnError: true }),
    json(),
    replace({
      delimiters: ['', ''],
      values: {
        "console.log('using faster connection')": '',
        'require(\'readable-stream/transform\')': 'require(\'stream\').Transform',
        'require("readable-stream/transform")': 'require("stream").Transform',
        'readable-stream': 'stream',
        "require('./lib/pool.js')": 'class FakePool {}',
        "require('./lib/pool_connection')": 'class FakePoolConnection {}' ,
        "require('./promise.js')": 'class FakePromiseMYSQL {}',
        // workaround for fix build error(patch for ssh2-streams/lib/sftp.js)
        "readString: readString,": '',
        "function readString(buffer, start, encoding, stream, cb, maxLen)": "export function readString(buffer, start, encoding, stream, cb, maxLen)",
      }
    }),
    commonjs({
      ignore: [
        'util',
        'pg-native',
        './native',
        './lib/pool_cluster.js',
        './pool.js',
        './lib/pool.js',
        './lib/pool_connection',
        './lib/pool_connection.js',
        './pool_connection.js',
        './promise.js'
      ],
      requireReturnsDefault: true,
    }),
    resolve({
      preferBuiltins: false,
    }),
  ]
};
