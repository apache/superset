"use strict";

exports.__esModule = true;
exports.default = getMultipleTextDimensions;

var _getBBoxCeil = _interopRequireDefault(require("./svg/getBBoxCeil"));

var _factories = require("./svg/factories");

var _updateTextNode = _interopRequireDefault(require("./svg/updateTextNode"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * get dimensions of multiple texts with same style
 * @param input
 * @param defaultDimension
 */
function getMultipleTextDimensions(input, defaultDimension) {
  const {
    texts,
    className,
    style,
    container
  } = input;
  const cache = new Map(); // for empty string

  cache.set('', {
    height: 0,
    width: 0
  });
  let textNode;
  let svgNode;
  const dimensions = texts.map(text => {
    // Check if this string has been computed already
    if (cache.has(text)) {
      return cache.get(text);
    } // Lazy creation of text and svg nodes


    if (!textNode) {
      svgNode = _factories.hiddenSvgFactory.createInContainer(container);
      textNode = _factories.textFactory.createInContainer(svgNode);
    } // Update text and get dimension


    (0, _updateTextNode.default)(textNode, {
      className,
      style,
      text
    });
    const dimension = (0, _getBBoxCeil.default)(textNode, defaultDimension); // Store result to cache

    cache.set(text, dimension);
    return dimension;
  }); // Remove svg node, if any

  if (svgNode && textNode) {
    // The nodes are added to the DOM briefly only to make getBBox works.
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
  }

  return dimensions;
}