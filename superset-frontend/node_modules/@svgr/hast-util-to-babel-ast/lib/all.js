"use strict";

exports.__esModule = true;
exports.default = void 0;

var _one = _interopRequireDefault(require("./one"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* Transform the children of `parent`. */
function all(h, parent) {
  const nodes = parent.children || [];
  const {
    length
  } = nodes;
  const values = [];
  let index = -1;

  while (++index < length) {
    const result = (0, _one.default)(h, nodes[index], parent);
    values.push(result);
  }

  return values.filter(node => node);
}

var _default = all;
exports.default = _default;