const path = require('path')
const src = path.resolve(__dirname, 'src/client')
const dist = path.resolve(__dirname, 'dist')

const client = {
  entry: {
    main: path.resolve(src, 'main.ts'),
    'editor.worker': 'monaco-editor-core/esm/vs/editor/editor.worker.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: dist
  },
  target: 'web',
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
    extensions: ['.js', '.json', '.ttf', '.ts']
  },
  devtool: 'source-map',
  module: {
    rules: [{
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
  }
}

module.exports = [client]