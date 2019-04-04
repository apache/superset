'use strict';

var typeMap = {};
var types = require('./types');

// load all available handlers
types.forEach(function (type) {
  typeMap[type] = require('./types/' + type).detect;
});

module.exports = function (buffer, filepath) {
  var type, result;
  for (type in typeMap) {
    result = typeMap[type](buffer, filepath);
    if (result) {
      return type;
    }
  }
};
