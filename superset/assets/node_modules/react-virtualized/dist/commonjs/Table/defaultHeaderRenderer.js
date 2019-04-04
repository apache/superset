'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = defaultHeaderRenderer;

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _SortIndicator = require('./SortIndicator');

var _SortIndicator2 = _interopRequireDefault(_SortIndicator);

var _types = require('./types');

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 * Default table header renderer.
 */
function defaultHeaderRenderer(_ref) {
  var dataKey = _ref.dataKey,
      label = _ref.label,
      sortBy = _ref.sortBy,
      sortDirection = _ref.sortDirection;

  var showSortIndicator = sortBy === dataKey;
  var children = [React.createElement(
    'span',
    {
      className: 'ReactVirtualized__Table__headerTruncatedText',
      key: 'label',
      title: label },
    label
  )];

  if (showSortIndicator) {
    children.push(React.createElement(_SortIndicator2.default, { key: 'SortIndicator', sortDirection: sortDirection }));
  }

  return children;
}
defaultHeaderRenderer.propTypes = process.env.NODE_ENV === 'production' ? null : _types.bpfrpt_proptype_HeaderRendererParams === _propTypes2.default.any ? {} : _types.bpfrpt_proptype_HeaderRendererParams;