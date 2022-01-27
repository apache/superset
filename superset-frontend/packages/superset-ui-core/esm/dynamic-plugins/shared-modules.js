(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};
































const modulePromises = {};

const withNamespace = (name) => `__superset__/${name}`;

/**
 * Dependency management using global variables, because for the life of me
 * I can't figure out how to hook into UMD from a dynamically imported package.
 *
 * This defines a dynamically imported js module that can be used to import from
 * multiple different plugins.
 *
 * When importing a common module (such as react or lodash or superset-ui)
 * from a plugin, the plugin's build config will be able to
 * reference these globals instead of rebuilding them.
 *
 * @param name the module's name (should match name in package.json)
 * @param promise the promise resulting from a call to `import(name)`
 */
export async function defineSharedModule(
name,
fetchModule)
{
  // this field on window is used by dynamic plugins to reference the module
  const moduleKey = withNamespace(name);

  if (!window[moduleKey] && !modulePromises[name]) {
    // if the module has not been loaded, load it
    const modulePromise = fetchModule();
    modulePromises[name] = modulePromise;
    // wait for the module to load, and attach the result to window
    // so that it can be referenced by plugins
    window[moduleKey] = await modulePromise;
  }

  // we always return a reference to the promise.
  // Multiple consumers can `.then()` or `await` the same promise,
  // even long after it has completed,
  // and it will always call back with the same reference.
  return modulePromises[name];
}

/**
 * Define multiple shared modules at once, using a map of name -> `import(name)`
 *
 * @see defineSharedModule
 * @param moduleMap
 */
export async function defineSharedModules(moduleMap)

{
  return Promise.all(
  Object.entries(moduleMap).map(([name, fetchModule]) =>
  defineSharedModule(name, fetchModule)));


}

// only exposed for tests
export function reset() {
  Object.keys(modulePromises).forEach((key) => {
    delete window[withNamespace(key)];
    delete modulePromises[key];
  });
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(modulePromises, "modulePromises", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dynamic-plugins/shared-modules.ts");reactHotLoader.register(withNamespace, "withNamespace", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dynamic-plugins/shared-modules.ts");reactHotLoader.register(defineSharedModule, "defineSharedModule", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dynamic-plugins/shared-modules.ts");reactHotLoader.register(defineSharedModules, "defineSharedModules", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dynamic-plugins/shared-modules.ts");reactHotLoader.register(reset, "reset", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dynamic-plugins/shared-modules.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();