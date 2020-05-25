const {
  MediaRedirectionDetector,
  getWindowHandleAsHex
} = require('mars-desktop');

process.once('loaded', () => {
  global.MediaRedirectionDetector = MediaRedirectionDetector;
  global.getWindowHandleAsHex = getWindowHandleAsHex;
});
