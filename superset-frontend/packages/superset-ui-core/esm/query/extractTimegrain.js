(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};






















export default function extractTimegrain(
formData)
{
  const { time_grain_sqla, extra_filters, extra_form_data } = formData;
  if (extra_form_data != null && extra_form_data.time_grain_sqla) {
    return extra_form_data.time_grain_sqla;
  }
  const extra_grain = (extra_filters || []).filter(
  (filter) => filter.col === '__time_grain');

  if (extra_grain.length) {
    return extra_grain[0].val;
  }
  return time_grain_sqla;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(extractTimegrain, "extractTimegrain", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/extractTimegrain.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();