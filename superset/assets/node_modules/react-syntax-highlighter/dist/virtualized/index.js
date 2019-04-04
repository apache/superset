'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = virtualizedRenderer;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactVirtualized = require('react-virtualized');

var _highlight = require('../highlight');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function rowRenderer(_ref, _ref2) {
  var rows = _ref.rows,
      stylesheet = _ref.stylesheet,
      useInlineStyles = _ref.useInlineStyles;
  var index = _ref2.index,
      key = _ref2.key,
      style = _ref2.style;

  return (0, _highlight.createElement)({
    node: rows[index],
    stylesheet: stylesheet,
    style: style,
    useInlineStyles: useInlineStyles,
    key: key
  });
}

function virtualizedRenderer(_ref3) {
  var _ref3$overscanRowCoun = _ref3.overscanRowCount,
      overscanRowCount = _ref3$overscanRowCoun === undefined ? 10 : _ref3$overscanRowCoun;

  return function (_ref4) {
    var rows = _ref4.rows,
        stylesheet = _ref4.stylesheet,
        useInlineStyles = _ref4.useInlineStyles;
    return _react2.default.createElement(
      'div',
      null,
      _react2.default.createElement(
        _reactVirtualized.AutoSizer,
        null,
        function (_ref5) {
          var height = _ref5.height,
              width = _ref5.width;
          return _react2.default.createElement(_reactVirtualized.List, {
            height: height,
            width: width,
            rowHeight: 15,
            rowRenderer: rowRenderer.bind(null, { rows: rows, stylesheet: stylesheet, useInlineStyles: useInlineStyles }),
            rowCount: rows.length,
            overscanRowCount: overscanRowCount
          });
        }
      )
    );
  };
}