module.exports = function () {
  if (process.browser) {
    return document.querySelector('body')
  } else {
    const {JSDOM} = require('jsdom')
    const {document} = (new JSDOM()).window
    return document.querySelector('body')
  }
}
