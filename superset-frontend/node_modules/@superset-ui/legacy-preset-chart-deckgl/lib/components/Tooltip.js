"use strict";

exports.__esModule = true;
exports.default = Tooltip;

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireWildcard(require("react"));

var _xss = require("xss");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function Tooltip(props) {
  const {
    tooltip
  } = props;

  if (typeof tooltip === 'undefined' || tooltip === null) {
    return null;
  }

  const {
    x,
    y,
    content
  } = tooltip; // eslint-disable-next-line react-hooks/rules-of-hooks

  const style = (0, _react.useMemo)(() => ({
    position: 'absolute',
    top: y + "px",
    left: x + "px",
    padding: '8px',
    margin: '8px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    maxWidth: '300px',
    fontSize: '12px',
    zIndex: 9,
    pointerEvents: 'none'
  }), [x, y]);

  if (typeof content === 'string') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const contentHtml = (0, _react.useMemo)(() => ({
      __html: (0, _xss.filterXSS)(content, {
        stripIgnoreTag: true
      })
    }), [content]);
    return _react.default.createElement("div", {
      style: style
    }, _react.default.createElement("div", {
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML: contentHtml
    }));
  }

  return _react.default.createElement("div", {
    style: style
  }, content);
}