(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};






















export default function makeSingleton(
BaseClass,
...args)
{
  let singleton;

  return function getInstance() {
    if (!singleton) {
      singleton = new BaseClass(...args);
    }

    return singleton;
  };
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(makeSingleton, "makeSingleton", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/utils/makeSingleton.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();