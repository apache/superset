(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};
























/** Turns an array of string/number options into options for a select input */
export function formatSelectOptions(
options)
{
  return options.map((opt) => Array.isArray(opt) ? opt : [opt, opt.toString()]);
}

/**
 * Outputs array of arrays
 *   >> formatSelectOptionsForRange(1, 5)
 *   >> [[1,'1'], [2,'2'], [3,'3'], [4,'4'], [5,'5']]
 */
export function formatSelectOptionsForRange(start, end) {
  const options = [];
  for (let i = start; i <= end; i += 1) {
    options.push([i, i.toString()]);
  }
  return options;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(formatSelectOptions, "formatSelectOptions", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/utils/selectOptions.ts");reactHotLoader.register(formatSelectOptionsForRange, "formatSelectOptionsForRange", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/utils/selectOptions.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();