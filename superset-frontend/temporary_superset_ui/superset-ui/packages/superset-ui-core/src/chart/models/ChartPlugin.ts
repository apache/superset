import { ComponentType } from 'react';
import { isRequired, Plugin, QueryFormData } from '../..';
import ChartMetadata from './ChartMetadata';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartControlPanelRegistry from '../registries/ChartControlPanelRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';
import { BuildQueryFunction, TransformProps } from '../types/TransformFunction';
import { ChartControlPanel } from './ChartControlPanel';

function IDENTITY<T>(x: T) {
  return x;
}

const EMPTY = {};

export type PromiseOrValue<T> = Promise<T> | T;
export type PromiseOrValueLoader<T> = () => PromiseOrValue<T>;
export type ChartType = ComponentType<any>;
type ValueOrModuleWithValue<T> = T | { default: T };

interface ChartPluginConfig<T extends QueryFormData> {
  metadata: ChartMetadata;
  /** Use buildQuery for immediate value. For lazy-loading, use loadBuildQuery. */
  buildQuery?: BuildQueryFunction<T>;
  /** Use loadBuildQuery for dynamic import (lazy-loading) */
  loadBuildQuery?: PromiseOrValueLoader<ValueOrModuleWithValue<BuildQueryFunction<T>>>;
  /** Use transformProps for immediate value. For lazy-loading, use loadTransformProps.  */
  transformProps?: TransformProps;
  /** Use loadTransformProps for dynamic import (lazy-loading) */
  loadTransformProps?: PromiseOrValueLoader<ValueOrModuleWithValue<TransformProps>>;
  /** Use Chart for immediate value. For lazy-loading, use loadChart. */
  Chart?: ChartType;
  /** Use loadChart for dynamic import (lazy-loading) */
  loadChart?: PromiseOrValueLoader<ValueOrModuleWithValue<ChartType>>;
  /** Control panel configuration object */
  controlPanel?: ChartControlPanel;
}

/**
 * Loaders of the form `() => import('foo')` may return esmodules
 * which require the value to be extracted as `module.default`
 * */
function sanitizeLoader<T>(
  loader: PromiseOrValueLoader<ValueOrModuleWithValue<T>>,
): PromiseOrValueLoader<T> {
  return () => {
    const loaded = loader();

    return loaded instanceof Promise
      ? (loaded.then(module => ('default' in module && module.default) || module) as Promise<T>)
      : (loaded as T);
  };
}

export default class ChartPlugin<T extends QueryFormData = QueryFormData> extends Plugin {
  controlPanel: ChartControlPanel;

  metadata: ChartMetadata;

  loadBuildQuery?: PromiseOrValueLoader<BuildQueryFunction<T>>;

  loadTransformProps: PromiseOrValueLoader<TransformProps>;

  loadChart: PromiseOrValueLoader<ChartType>;

  constructor(config: ChartPluginConfig<T>) {
    super();
    const {
      metadata,
      buildQuery,
      loadBuildQuery,
      transformProps = IDENTITY,
      loadTransformProps,
      Chart,
      loadChart,
      controlPanel = EMPTY,
    } = config;
    this.controlPanel = controlPanel;
    this.metadata = metadata;
    this.loadBuildQuery =
      (loadBuildQuery && sanitizeLoader(loadBuildQuery)) ||
      (buildQuery && sanitizeLoader(() => buildQuery)) ||
      undefined;
    this.loadTransformProps = sanitizeLoader(loadTransformProps ?? (() => transformProps));

    if (loadChart) {
      this.loadChart = sanitizeLoader<ChartType>(loadChart);
    } else if (Chart) {
      this.loadChart = () => Chart;
    } else {
      throw new Error('Chart or loadChart is required');
    }
  }

  register() {
    const { key = isRequired('config.key') } = this.config;
    getChartMetadataRegistry().registerValue(key as string, this.metadata);
    getChartComponentRegistry().registerLoader(key as string, this.loadChart);
    getChartControlPanelRegistry().registerValue(key as string, this.controlPanel);
    getChartTransformPropsRegistry().registerLoader(key as string, this.loadTransformProps);
    if (this.loadBuildQuery) {
      getChartBuildQueryRegistry().registerLoader(key as string, this.loadBuildQuery);
    }

    return this;
  }

  unregister() {
    const { key = isRequired('config.key') } = this.config;
    getChartMetadataRegistry().remove(key as string);
    getChartComponentRegistry().remove(key as string);
    getChartControlPanelRegistry().remove(key as string);
    getChartTransformPropsRegistry().remove(key as string);
    getChartBuildQueryRegistry().remove(key as string);

    return this;
  }

  configure(config: { [key: string]: unknown }, replace?: boolean) {
    super.configure(config, replace);

    return this;
  }
}
