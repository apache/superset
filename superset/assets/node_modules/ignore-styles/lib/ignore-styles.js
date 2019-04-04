'use strict';

exports.__esModule = true;
exports.noOp = noOp;
exports.restore = restore;
exports.default = register;
var DEFAULT_EXTENSIONS = exports.DEFAULT_EXTENSIONS = ['.css', '.scss', '.sass', '.pcss', '.stylus', '.styl', '.less', '.sss', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.mp4', '.webm', '.ogv'];

var oldHandlers = exports.oldHandlers = {};

function noOp() {}

function restore() {
  for (var ext in oldHandlers) {
    if (oldHandlers[ext] === undefined) {
      delete require.extensions[ext];
    } else {
      require.extensions[ext] = oldHandlers[ext];
    }
  }

  exports.oldHandlers = oldHandlers = {};
}

function register() {
  var extensions = arguments.length <= 0 || arguments[0] === undefined ? DEFAULT_EXTENSIONS : arguments[0];
  var handler = arguments.length <= 1 || arguments[1] === undefined ? noOp : arguments[1];

  restore();

  for (var _iterator = extensions, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref = _i.value;
    }

    var ext = _ref;

    oldHandlers[ext] = require.extensions[ext];
    require.extensions[ext] = handler;
  }
}

// Run at import
register();

//# sourceMappingURL=ignore-styles.js.map