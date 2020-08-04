"use strict";

exports.__esModule = true;
exports.default = getTextDimension;

var _updateTextNode = _interopRequireDefault(require("./svg/updateTextNode"));

var _getBBoxCeil = _interopRequireDefault(require("./svg/getBBoxCeil"));

var _factories = require("./svg/factories");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getTextDimension(input, defaultDimension) {
  const {
    text,
    className,
    style,
    container
  } = input; // Empty string

  if (text.length === 0) {
    return {
      height: 0,
      width: 0
    };
  }

  const svgNode = _factories.hiddenSvgFactory.createInContainer(container);

  const textNode = _factories.textFactory.createInContainer(svgNode);

  (0, _updateTextNode.default)(textNode, {
    className,
    style,
    text
  });
  const dimension = (0, _getBBoxCeil.default)(textNode, defaultDimension); // The nodes are added to the DOM briefly only to make getBBox works.
  // (If not added to DOM getBBox will always return 0x0.)
  // After that the svg nodes are not needed.
  // We delay its removal in case there are subsequent calls to this function
  // that can reuse the svg nodes.
  // Experiments have shown that reusing existing nodes
  // instead of deleting and adding new ones can save lot of time.

  setTimeout(() => {
    _factories.textFactory.removeFromContainer(svgNode);

    _factories.hiddenSvgFactory.removeFromContainer(container);
  }, 500);
  return dimension;
}