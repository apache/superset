(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















export const sortAlphanumericCaseInsensitive = (
rowA,
rowB,
columnId) =>
{
  const valueA = rowA.values[columnId];
  const valueB = rowB.values[columnId];

  if (!valueA || typeof valueA !== 'string') {
    return -1;
  }
  if (!valueB || typeof valueB !== 'string') {
    return 1;
  }
  return valueA.localeCompare(valueB) > 0 ? 1 : -1;
};;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(sortAlphanumericCaseInsensitive, "sortAlphanumericCaseInsensitive", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/utils/sortAlphanumericCaseInsensitive.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();