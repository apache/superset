(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















const STYLE_FIELDS = [
'font',
'fontWeight',
'fontStyle',
'fontSize',
'fontFamily',
'letterSpacing'];


export default function updateTextNode(
node,
{
  className,
  style = {},
  text } =




{})
{
  const textNode = node;

  if (textNode.textContent !== text) {
    textNode.textContent = typeof text === 'undefined' ? null : text;
  }
  if (textNode.getAttribute('class') !== className) {
    textNode.setAttribute('class', className != null ? className : '');
  }

  // Clear style
  // Note: multi-word property names are hyphenated and not camel-cased.
  textNode.style.removeProperty('font');
  textNode.style.removeProperty('font-weight');
  textNode.style.removeProperty('font-style');
  textNode.style.removeProperty('font-size');
  textNode.style.removeProperty('font-family');
  textNode.style.removeProperty('letter-spacing');

  // Apply new style
  // Note: the font field will auto-populate other font fields when applicable.
  STYLE_FIELDS.filter(
  (field) =>
  typeof style[field] !== 'undefined' && style[field] !== null).
  forEach((field) => {
    textNode.style[field] = `${style[field]}`;
  });

  return textNode;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(STYLE_FIELDS, "STYLE_FIELDS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dimension/svg/updateTextNode.ts");reactHotLoader.register(updateTextNode, "updateTextNode", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dimension/svg/updateTextNode.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();