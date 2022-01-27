(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















function mergeOneSide(
operation,
a = 0,
b = 0)
{
  if (Number.isNaN(a) || a === null) return b;
  if (Number.isNaN(b) || b === null) return a;

  return operation(a, b);
}

export default function mergeMargin(
margin1 = {},
margin2 = {},
mode = 'expand')
{
  const { top, left, bottom, right } = margin1;
  const operation = mode === 'expand' ? Math.max : Math.min;

  return {
    bottom: mergeOneSide(operation, bottom, margin2.bottom),
    left: mergeOneSide(operation, left, margin2.left),
    right: mergeOneSide(operation, right, margin2.right),
    top: mergeOneSide(operation, top, margin2.top) };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(mergeOneSide, "mergeOneSide", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dimension/mergeMargin.ts");reactHotLoader.register(mergeMargin, "mergeMargin", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dimension/mergeMargin.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();