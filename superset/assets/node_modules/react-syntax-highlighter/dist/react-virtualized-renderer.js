'use strict';

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _reactSyntaxHighlighter = require('react-syntax-highlighter');

var _reactSyntaxHighlighter2 = _interopRequireDefault(_reactSyntaxHighlighter);

var _reactVirtualized = require('react-virtualized');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var rowRenderer = function rowRenderer(rows, style, useInlineStyles, virtualProps) {
  return (0, _reactSyntaxHighlighter.createElement)({
    node: rows[virtualProps.index],
    style: (0, _extends3.default)({}, rowStyle, virtualProps.style),
    key: virtualProps.key,
    useInlineStyles: useInlineStyles
  });
};

var renderer = function renderer(_ref) {
  var rows = _ref.rows,
      style = _ref.style,
      useInlineStyles = _ref.useInlineStyles;

  return React.createElement(_reactVirtualized.List, {
    rowCount: rows.length,
    rowHeight: 25,
    rowRenderer: rowRenderer.bind(null, rows, style, useInlineStyles),
    width: 500,
    height: 500
  });
};