"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bpfrpt_proptype_SizeInfo = exports.bpfrpt_proptype_SizeAndPositionInfo = exports.bpfrpt_proptype_ScrollPosition = exports.bpfrpt_proptype_PositionInfo = exports.bpfrpt_proptype_Index = undefined;

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var bpfrpt_proptype_Index = process.env.NODE_ENV === 'production' ? null : {
  index: _propTypes2.default.number.isRequired
};
var bpfrpt_proptype_PositionInfo = process.env.NODE_ENV === 'production' ? null : {
  x: _propTypes2.default.number.isRequired,
  y: _propTypes2.default.number.isRequired
};
var bpfrpt_proptype_ScrollPosition = process.env.NODE_ENV === 'production' ? null : {
  scrollLeft: _propTypes2.default.number.isRequired,
  scrollTop: _propTypes2.default.number.isRequired
};
var bpfrpt_proptype_SizeAndPositionInfo = process.env.NODE_ENV === 'production' ? null : {
  height: _propTypes2.default.number.isRequired,
  width: _propTypes2.default.number.isRequired,
  x: _propTypes2.default.number.isRequired,
  y: _propTypes2.default.number.isRequired
};
var bpfrpt_proptype_SizeInfo = process.env.NODE_ENV === 'production' ? null : {
  height: _propTypes2.default.number.isRequired,
  width: _propTypes2.default.number.isRequired
};
exports.bpfrpt_proptype_Index = bpfrpt_proptype_Index;
exports.bpfrpt_proptype_PositionInfo = bpfrpt_proptype_PositionInfo;
exports.bpfrpt_proptype_ScrollPosition = bpfrpt_proptype_ScrollPosition;
exports.bpfrpt_proptype_SizeAndPositionInfo = bpfrpt_proptype_SizeAndPositionInfo;
exports.bpfrpt_proptype_SizeInfo = bpfrpt_proptype_SizeInfo;