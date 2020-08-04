exports = module.exports = function (...args) {
  return register(...args);
};

exports.__esModule = true;

const node = require("./node");

const register = node.default;
Object.assign(exports, node);