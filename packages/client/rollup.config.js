import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: 'extension.ts',
  output: {
    dir: 'out',
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    typescript(),
    resolve(),
    commonjs({
      include: ["node_modules/**/*", "../../node_modules/**/*"]
    })
  ]
};
