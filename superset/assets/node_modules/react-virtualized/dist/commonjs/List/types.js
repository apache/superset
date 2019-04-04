'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bpfrpt_proptype_Scroll = exports.bpfrpt_proptype_RenderedRows = exports.bpfrpt_proptype_RowRenderer = exports.bpfrpt_proptype_RowRendererParams = undefined;

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var bpfrpt_proptype_RowRendererParams = process.env.NODE_ENV === 'production' ? null : {
  index: _propTypes2.default.number.isRequired,
  isScrolling: _propTypes2.default.bool.isRequired,
  isVisible: _propTypes2.default.bool.isRequired,
  key: _propTypes2.default.string.isRequired,
  parent: _propTypes2.default.object.isRequired,
  style: _propTypes2.default.object.isRequired
};
var bpfrpt_proptype_RowRenderer = process.env.NODE_ENV === 'production' ? null : _propTypes2.default.func;
var bpfrpt_proptype_RenderedRows = process.env.NODE_ENV === 'production' ? null : {
  overscanStartIndex: _propTypes2.default.number.isRequired,
  overscanStopIndex: _propTypes2.default.number.isRequired,
  startIndex: _propTypes2.default.number.isRequired,
  stopIndex: _propTypes2.default.number.isRequired
};
var bpfrpt_proptype_Scroll = process.env.NODE_ENV === 'production' ? null : {
  clientHeight: _propTypes2.default.number.isRequired,
  scrollHeight: _propTypes2.default.number.isRequired,
  scrollTop: _propTypes2.default.number.isRequired
};
exports.bpfrpt_proptype_RowRendererParams = bpfrpt_proptype_RowRendererParams;
exports.bpfrpt_proptype_RowRenderer = bpfrpt_proptype_RowRenderer;
exports.bpfrpt_proptype_RenderedRows = bpfrpt_proptype_RenderedRows;
exports.bpfrpt_proptype_Scroll = bpfrpt_proptype_Scroll;