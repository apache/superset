'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = defaultHeaderRowRenderer;

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _types = require('./types');

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function defaultHeaderRowRenderer(_ref) {
  var className = _ref.className,
      columns = _ref.columns,
      style = _ref.style;

  return React.createElement(
    'div',
    { className: className, role: 'row', style: style },
    columns
  );
}
defaultHeaderRowRenderer.propTypes = process.env.NODE_ENV === 'production' ? null : _types.bpfrpt_proptype_HeaderRowRendererParams === _propTypes2.default.any ? {} : _types.bpfrpt_proptype_HeaderRowRendererParams;