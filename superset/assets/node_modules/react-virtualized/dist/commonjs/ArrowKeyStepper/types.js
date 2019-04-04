"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bpfrpt_proptype_ScrollIndices = undefined;

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var bpfrpt_proptype_ScrollIndices = process.env.NODE_ENV === 'production' ? null : {
  scrollToColumn: _propTypes2.default.number.isRequired,
  scrollToRow: _propTypes2.default.number.isRequired
};
exports.bpfrpt_proptype_ScrollIndices = bpfrpt_proptype_ScrollIndices;