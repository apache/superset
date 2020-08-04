require('../../modules/web.dom-collections.iterator');
var entries = require('../array/virtual/entries');
var classof = require('../../internals/classof');
var ArrayPrototype = Array.prototype;

var DOMIterables = {
  DOMTokenList: true,
  NodeList: true
};

module.exports = function (it) {
  var own = it.entries;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.entries)
    // eslint-disable-next-line no-prototype-builtins
    || DOMIterables.hasOwnProperty(classof(it)) ? entries : own;
};
