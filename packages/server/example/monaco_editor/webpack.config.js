const path = require('path')
const lib = path.resolve(__dirname, 'lib')

module.exports = {
  entry: {
    main: path.resolve(lib, 'main.js'),
    'editor.worker': 'monaco-editor-core/esm/vs/editor/editor.worker.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: lib
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
    extensions: ['.js', '.json', '.ttf']
  },
  devtool: 'source-map',
  module: {
    rules: [{
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
      loader: 'source-map-loader'
    }]
  }
}