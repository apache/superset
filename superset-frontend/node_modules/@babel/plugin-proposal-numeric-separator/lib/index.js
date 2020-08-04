"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _pluginSyntaxNumericSeparator = _interopRequireDefault(require("@babel/plugin-syntax-numeric-separator"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)(api => {
  api.assertVersion(7);
  return {
    name: "proposal-numeric-separator",
    inherits: _pluginSyntaxNumericSeparator.default,
    visitor: {
      NumericLiteral({
        node
      }) {
        const {
          extra
        } = node;

        if (extra && /_/.test(extra.raw)) {
          extra.raw = extra.raw.replace(/_/g, "");
        }
      }

    }
  };
});

exports.default = _default;