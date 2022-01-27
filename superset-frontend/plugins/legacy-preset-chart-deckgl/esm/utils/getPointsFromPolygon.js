(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};






































export default function getPointsFromPolygon(
feature)
{
  return 'geometry' in feature.polygon ?
  feature.polygon.geometry.coordinates[0] :
  feature.polygon;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(getPointsFromPolygon, "getPointsFromPolygon", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/utils/getPointsFromPolygon.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();