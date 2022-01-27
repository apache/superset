(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















export const contributionOperator =

(formData, queryObject) => {
  if (formData.contributionMode) {
    return {
      operation: 'contribution',
      options: {
        orientation: formData.contributionMode } };


  }
  return undefined;
};;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(contributionOperator, "contributionOperator", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/operators/contributionOperator.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();