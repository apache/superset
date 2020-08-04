import _pt from "prop-types";

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

import React from 'react';
export default function ShapeRect(_ref) {
  var fill = _ref.fill,
      width = _ref.width,
      height = _ref.height,
      style = _ref.style;
  return /*#__PURE__*/React.createElement("div", {
    style: _extends({
      width: width,
      height: height,
      background: fill
    }, style)
  });
}
ShapeRect.propTypes = {
  fill: _pt.string,
  width: _pt.oneOfType([_pt.string, _pt.number]),
  height: _pt.oneOfType([_pt.string, _pt.number])
};