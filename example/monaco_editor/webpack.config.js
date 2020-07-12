const path = require('path')
const src = path.resolve(__dirname, 'src/client')
const dist = path.resolve(__dirname, 'dist')

const client = {
  entry: {
    main: path.resolve(src, 'index.ts'),
    'editor.worker': 'monaco-editor-core/esm/vs/editor/editor.worker.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: dist
  },
  target: 'web',
  mode: 'development',
  node: {
    fs: 'empty',
    child_process: 'empty',
    net: 'empty',
    crypto: 'empty'
  },
  resolve: {
    alias: {
      'vscode': require.resolve('monaco-languageclient/lib/vscode-compatibility')
    },
    extensions: ['.js', '.json', '.ttf', '.ts', '.svelte']
  },
  devtool: 'source-map',
  module: {
    rules: [{
      test: /\.svelte$/,
      use: {
        loader: 'svelte-loader'
      }
    },
    {
      test: /\.ts$/,
      use: [
        {
          loader: 'ts-loader',
          options: {
            transpileOnly: true
          },
        }
      ],
      exclude: /node_modules/
    },
    {
      test: /\.css$/i,
      use: ['style-loader', 'css-loader']
    },
    {
      test: /\.ttf$/,
      use: ['file-loader']
    },
    {
      test: /\.js$/,
      enforce: 'pre',
      loader: 'source-map-loader',
      exclude: /node_modules/
    }]
  },
  watchOptions: {
    poll: 1000
  }
}

module.exports = [client]