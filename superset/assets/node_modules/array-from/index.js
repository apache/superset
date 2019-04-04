module.exports = (typeof Array.from === 'function' ?
  Array.from :
  require('./polyfill')
);
