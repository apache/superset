import _pt from "prop-types";
import React from 'react';
export default function ScaleSVG(_ref) {
  var children = _ref.children,
      width = _ref.width,
      height = _ref.height,
      _ref$xOrigin = _ref.xOrigin,
      xOrigin = _ref$xOrigin === void 0 ? 0 : _ref$xOrigin,
      _ref$yOrigin = _ref.yOrigin,
      yOrigin = _ref$yOrigin === void 0 ? 0 : _ref$yOrigin,
      _ref$preserveAspectRa = _ref.preserveAspectRatio,
      preserveAspectRatio = _ref$preserveAspectRa === void 0 ? 'xMinYMin meet' : _ref$preserveAspectRa,
      innerRef = _ref.innerRef;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-block',
      position: 'relative',
      width: '100%',
      verticalAlign: 'top',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    preserveAspectRatio: preserveAspectRatio,
    viewBox: xOrigin + " " + yOrigin + " " + width + " " + height,
    ref: innerRef
  }, children));
}
ScaleSVG.propTypes = {
  children: _pt.node,
  width: _pt.oneOfType([_pt.number, _pt.string]),
  height: _pt.oneOfType([_pt.number, _pt.string]),
  xOrigin: _pt.oneOfType([_pt.number, _pt.string]),
  yOrigin: _pt.oneOfType([_pt.number, _pt.string]),
  preserveAspectRatio: _pt.string,
  innerRef: _pt.oneOfType([_pt.string, _pt.func, _pt.object])
};