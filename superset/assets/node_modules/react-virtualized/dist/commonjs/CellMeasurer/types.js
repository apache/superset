"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bpfrpt_proptype_CellMeasureCache = undefined;

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var bpfrpt_proptype_CellMeasureCache = process.env.NODE_ENV === 'production' ? null : {
  hasFixedWidth: _propTypes2.default.func.isRequired,
  hasFixedHeight: _propTypes2.default.func.isRequired,
  has: _propTypes2.default.func.isRequired,
  set: _propTypes2.default.func.isRequired,
  getHeight: _propTypes2.default.func.isRequired,
  getWidth: _propTypes2.default.func.isRequired
};
exports.bpfrpt_proptype_CellMeasureCache = bpfrpt_proptype_CellMeasureCache;