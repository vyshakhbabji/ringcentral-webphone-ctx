const {
  MediaRedirectionDetector,
  getWindowHandleAsHex
} = require('web-adapter-desktop');

process.once('loaded', () => {
  global.MediaRedirectionDetector = MediaRedirectionDetector;
  global.getWindowHandleAsHex = getWindowHandleAsHex;
});
