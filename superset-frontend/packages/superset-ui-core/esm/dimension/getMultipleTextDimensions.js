(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};



















import getBBoxCeil from './svg/getBBoxCeil';
import { hiddenSvgFactory, textFactory } from './svg/factories';
import updateTextNode from './svg/updateTextNode';

/**
 * get dimensions of multiple texts with same style
 * @param input
 * @param defaultDimension
 */
export default function getMultipleTextDimensions(
input,





defaultDimension)
{
  const { texts, className, style, container } = input;

  const cache = new Map();
  // for empty string
  cache.set('', { height: 0, width: 0 });
  let textNode;
  let svgNode;

  const dimensions = texts.map((text) => {
    // Check if this string has been computed already
    if (cache.has(text)) {
      return cache.get(text);
    }

    // Lazy creation of text and svg nodes
    if (!textNode) {
      svgNode = hiddenSvgFactory.createInContainer(container);
      textNode = textFactory.createInContainer(svgNode);
    }

    // Update text and get dimension
    updateTextNode(textNode, { className, style, text });
    const dimension = getBBoxCeil(textNode, defaultDimension);
    // Store result to cache
    cache.set(text, dimension);

    return dimension;
  });

  // Remove svg node, if any
  if (svgNode && textNode) {
    // The nodes are added to the DOM briefly only to make getBBox works.
    // (If not added to DOM getBBox will always return 0x0.)
    // After that the svg nodes are not needed.
    // We delay its removal in case there are subsequent calls to this function
    // that can reuse the svg nodes.
    // Experiments have shown that reusing existing nodes
    // instead of deleting and adding new ones can save lot of time.
    setTimeout(() => {
      textFactory.removeFromContainer(svgNode);
      hiddenSvgFactory.removeFromContainer(container);
    }, 500);
  }

  return dimensions;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(getMultipleTextDimensions, "getMultipleTextDimensions", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dimension/getMultipleTextDimensions.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();