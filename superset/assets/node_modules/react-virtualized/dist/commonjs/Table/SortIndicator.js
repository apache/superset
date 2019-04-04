'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = SortIndicator;

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _SortDirection = require('./SortDirection');

var _SortDirection2 = _interopRequireDefault(_SortDirection);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Displayed beside a header to indicate that a Table is currently sorted by this column.
 */
function SortIndicator(_ref) {
  var sortDirection = _ref.sortDirection;

  var classNames = (0, _classnames2.default)('ReactVirtualized__Table__sortableHeaderIcon', {
    'ReactVirtualized__Table__sortableHeaderIcon--ASC': sortDirection === _SortDirection2.default.ASC,
    'ReactVirtualized__Table__sortableHeaderIcon--DESC': sortDirection === _SortDirection2.default.DESC
  });

  return React.createElement(
    'svg',
    { className: classNames, width: 18, height: 18, viewBox: '0 0 24 24' },
    sortDirection === _SortDirection2.default.ASC ? React.createElement('path', { d: 'M7 14l5-5 5 5z' }) : React.createElement('path', { d: 'M7 10l5 5 5-5z' }),
    React.createElement('path', { d: 'M0 0h24v24H0z', fill: 'none' })
  );
}

SortIndicator.propTypes = process.env.NODE_ENV !== "production" ? {
  sortDirection: _propTypes2.default.oneOf([_SortDirection2.default.ASC, _SortDirection2.default.DESC])
} : {};