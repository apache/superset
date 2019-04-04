"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = checkDeprecatedProps;
// 'new' is optional
var DEPRECATED_PROPS = [{
  old: 'onChangeViewport',
  new: 'onViewportChange'
}, {
  old: 'perspectiveEnabled',
  new: 'dragRotate'
}, {
  old: 'onHoverFeatures',
  new: 'onHover'
}, {
  old: 'onClickFeatures',
  new: 'onClick'
}, {
  old: 'touchZoomRotate',
  new: 'touchZoom, touchRotate'
}, {
  old: 'mapControls',
  new: 'controller'
}];

function getDeprecatedText(name) {
  return "react-map-gl: `".concat(name, "` is removed.");
}

function getNewText(name) {
  return "Use `".concat(name, "` instead.");
}
/**
 * Checks props object for any prop that is deprecated and insert a console
 * warning to the user. This will also print out the recommended new prop/API
 * if one exists.
 */


function checkDeprecatedProps() {
  var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  /* eslint-disable no-console, no-undef */
  DEPRECATED_PROPS.forEach(function (depProp) {
    if (props.hasOwnProperty(depProp.old)) {
      var warnMessage = getDeprecatedText(depProp.old);

      if (depProp.new) {
        warnMessage = "".concat(warnMessage, " ").concat(getNewText(depProp.new));
      }

      console.warn(warnMessage);
    }
  });
}
//# sourceMappingURL=deprecate-warn.js.map