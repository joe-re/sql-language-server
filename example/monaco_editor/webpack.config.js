const path = require('path')
const src = path.resolve(__dirname, 'src')
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
      use: 'ts-loader',
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

const server = {
  entry: {
    server: path.resolve(src, 'server.ts'),
  },
  output: {
    filename: '[name].bundle.js',
    path: dist
  },
  target: 'node',
  externals: ['aws-sdk', 'pg-native'],
  node: {
    fs: 'empty',
    child_process: 'empty',
    net: 'empty',
    crypto: 'empty',
    tls: 'empty',
    readline: 'empty',
    dns: 'empty'
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
      use: 'ts-loader',
      exclude: /node_modules/
    },
    {
      test: /\.js$/,
      enforce: 'pre',
      loader: 'source-map-loader',
      exclude: /node_modules/
    }]
  }
}

module.exports = [client, server]