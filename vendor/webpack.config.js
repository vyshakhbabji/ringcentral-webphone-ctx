const path = require('path');

module.exports = {
  entry: './citrix-webrtc/CitrixWebRTC.min.js',
  output: {
    filename: 'citrix-webrtc.js',
    path: path.resolve(__dirname, '../src/script'),
    library: 'CitrixWebRTC',
    libraryTarget: 'umd',
    libraryExport: ''
  },
  resolve: {
    extensions: ['.js']
  },
  optimization: {
    minimize: false
  },
  mode: 'production',
  module: {},
};
