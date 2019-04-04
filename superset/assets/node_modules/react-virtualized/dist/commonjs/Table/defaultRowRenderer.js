'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

exports.default = defaultRowRenderer;

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _types = require('./types');

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Default row renderer for Table.
 */
function defaultRowRenderer(_ref) {
  var className = _ref.className,
      columns = _ref.columns,
      index = _ref.index,
      key = _ref.key,
      onRowClick = _ref.onRowClick,
      onRowDoubleClick = _ref.onRowDoubleClick,
      onRowMouseOut = _ref.onRowMouseOut,
      onRowMouseOver = _ref.onRowMouseOver,
      onRowRightClick = _ref.onRowRightClick,
      rowData = _ref.rowData,
      style = _ref.style;

  var a11yProps = {};

  if (onRowClick || onRowDoubleClick || onRowMouseOut || onRowMouseOver || onRowRightClick) {
    a11yProps['aria-label'] = 'row';
    a11yProps.tabIndex = 0;

    if (onRowClick) {
      a11yProps.onClick = function (event) {
        return onRowClick({ event: event, index: index, rowData: rowData });
      };
    }
    if (onRowDoubleClick) {
      a11yProps.onDoubleClick = function (event) {
        return onRowDoubleClick({ event: event, index: index, rowData: rowData });
      };
    }
    if (onRowMouseOut) {
      a11yProps.onMouseOut = function (event) {
        return onRowMouseOut({ event: event, index: index, rowData: rowData });
      };
    }
    if (onRowMouseOver) {
      a11yProps.onMouseOver = function (event) {
        return onRowMouseOver({ event: event, index: index, rowData: rowData });
      };
    }
    if (onRowRightClick) {
      a11yProps.onContextMenu = function (event) {
        return onRowRightClick({ event: event, index: index, rowData: rowData });
      };
    }
  }

  return React.createElement(
    'div',
    (0, _extends3.default)({}, a11yProps, {
      className: className,
      key: key,
      role: 'row',
      style: style }),
    columns
  );
}
defaultRowRenderer.propTypes = process.env.NODE_ENV === 'production' ? null : _types.bpfrpt_proptype_RowRendererParams === _propTypes2.default.any ? {} : _types.bpfrpt_proptype_RowRendererParams;