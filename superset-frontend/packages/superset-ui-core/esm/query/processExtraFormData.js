(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};


















import {
EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS,
EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS } from
'./constants';

export function overrideExtraFormData(
queryObject,
overrideFormData)
{
  const overriddenFormData = { ...queryObject };
  const { extras: overriddenExtras = {} } = overriddenFormData;
  Object.entries(EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS).forEach(
  ([key, target]) => {
    const value = overrideFormData[key];
    if (value !== undefined) {
      overriddenFormData[target] = value;
    }
  });

  EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS.forEach((key) => {
    if (key in overrideFormData) {
      // @ts-ignore
      overriddenExtras[key] = overrideFormData[key];
    }
  });
  if (Object.keys(overriddenExtras).length > 0) {
    overriddenFormData.extras = overriddenExtras;
  }
  return overriddenFormData;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(overrideExtraFormData, "overrideExtraFormData", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/processExtraFormData.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();