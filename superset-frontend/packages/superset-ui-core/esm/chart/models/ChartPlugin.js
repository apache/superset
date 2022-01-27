(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};



















import { isRequired, Plugin } from '../..';

import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartControlPanelRegistry from '../registries/ChartControlPanelRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';




function IDENTITY(x) {
  return x;
}

const EMPTY = {};































/**
 * Loaders of the form `() => import('foo')` may return esmodules
 * which require the value to be extracted as `module.default`
 * */
function sanitizeLoader(
loader)
{
  return () => {
    const loaded = loader();

    return loaded instanceof Promise ?
    loaded.then(
    (module) => 'default' in module && module.default || module) :

    loaded;
  };
}

export default class ChartPlugin extends


Plugin {










  constructor(config) {
    super();this.controlPanel = void 0;this.metadata = void 0;this.loadBuildQuery = void 0;this.loadTransformProps = void 0;this.loadChart = void 0;
    const {
      metadata,
      buildQuery,
      loadBuildQuery,
      transformProps = IDENTITY,
      loadTransformProps,
      Chart,
      loadChart,
      controlPanel = EMPTY } =
    config;
    this.controlPanel = controlPanel;
    this.metadata = metadata;
    this.loadBuildQuery =
    loadBuildQuery && sanitizeLoader(loadBuildQuery) ||
    buildQuery && sanitizeLoader(() => buildQuery) ||
    undefined;
    this.loadTransformProps = sanitizeLoader(
    loadTransformProps != null ? loadTransformProps : () => transformProps);


    if (loadChart) {
      this.loadChart = sanitizeLoader(loadChart);
    } else if (Chart) {
      this.loadChart = () => Chart;
    } else {
      throw new Error('Chart or loadChart is required');
    }
  }

  register() {
    const key = this.config.key || isRequired('config.key');
    getChartMetadataRegistry().registerValue(key, this.metadata);
    getChartComponentRegistry().registerLoader(key, this.loadChart);
    getChartControlPanelRegistry().registerValue(key, this.controlPanel);
    getChartTransformPropsRegistry().registerLoader(
    key,
    this.loadTransformProps);

    if (this.loadBuildQuery) {
      getChartBuildQueryRegistry().registerLoader(key, this.loadBuildQuery);
    }
    return this;
  }

  unregister() {
    const key = this.config.key || isRequired('config.key');
    getChartMetadataRegistry().remove(key);
    getChartComponentRegistry().remove(key);
    getChartControlPanelRegistry().remove(key);
    getChartTransformPropsRegistry().remove(key);
    getChartBuildQueryRegistry().remove(key);
    return this;
  }

  configure(config, replace) {
    super.configure(config, replace);

    return this;
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(IDENTITY, "IDENTITY", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/models/ChartPlugin.ts");reactHotLoader.register(EMPTY, "EMPTY", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/models/ChartPlugin.ts");reactHotLoader.register(sanitizeLoader, "sanitizeLoader", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/models/ChartPlugin.ts");reactHotLoader.register(ChartPlugin, "ChartPlugin", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/models/ChartPlugin.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();