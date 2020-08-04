"use strict";

exports.__esModule = true;
exports.textFactory = exports.hiddenSvgFactory = void 0;

var _LazyFactory = _interopRequireDefault(require("./LazyFactory"));

var _createHiddenSvgNode = _interopRequireDefault(require("./createHiddenSvgNode"));

var _createTextNode = _interopRequireDefault(require("./createTextNode"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const hiddenSvgFactory = new _LazyFactory.default(_createHiddenSvgNode.default);
exports.hiddenSvgFactory = hiddenSvgFactory;
const textFactory = new _LazyFactory.default(_createTextNode.default);
exports.textFactory = textFactory;