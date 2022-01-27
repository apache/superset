(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};



















/**
 * Convert Datasource columns to column choices
 */
export default function columnChoices(
datasource)
{
  return (
    (datasource == null ? void 0 : datasource.columns.
    map((col) => [
    col.column_name,
    col.verbose_name || col.column_name]).

    sort((opt1, opt2) =>
    opt1[1].toLowerCase() > opt2[1].toLowerCase() ? 1 : -1)) ||
    []);

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(columnChoices, "columnChoices", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/utils/columnChoices.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();