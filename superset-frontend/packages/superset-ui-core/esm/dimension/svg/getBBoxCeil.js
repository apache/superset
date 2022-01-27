(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















const DEFAULT_DIMENSION = { height: 20, width: 100 };

export default function getBBoxCeil(
node,
defaultDimension = DEFAULT_DIMENSION)
{
  const { width, height } = node.getBBox ? node.getBBox() : defaultDimension;

  return {
    height: Math.ceil(height),
    width: Math.ceil(width) };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_DIMENSION, "DEFAULT_DIMENSION", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dimension/svg/getBBoxCeil.ts");reactHotLoader.register(getBBoxCeil, "getBBoxCeil", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dimension/svg/getBBoxCeil.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();