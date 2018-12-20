import { isRequired, Plugin } from '@superset-ui/core';
import ChartMetadata from './ChartMetadata';
import ChartProps from './ChartProps';
import { FormData } from '../query/FormData';
import { QueryContext } from '../query/buildQueryContext';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';

const IDENTITY = (x: any) => x;

type PromiseOrValue<T> = Promise<T> | T;
type PromiseOrValueLoader<T> = () => PromiseOrValue<T> | PromiseOrValue<{ default: T }>;

export type BuildQueryFunction = (formData: FormData) => QueryContext;

export type TransformPropsFunction = (
  chartProps: ChartProps,
) => {
  [key: string]: any;
};

export interface ChartPluginConfig {
  metadata: ChartMetadata;
  // use buildQuery for immediate value
  buildQuery?: BuildQueryFunction;
  // use loadBuildQuery for dynamic import (lazy-loading)
  loadBuildQuery?: PromiseOrValueLoader<BuildQueryFunction>;
  // use transformProps for immediate value
  transformProps?: TransformPropsFunction;
  // use loadTransformProps for dynamic import (lazy-loading)
  loadTransformProps?: PromiseOrValueLoader<TransformPropsFunction>;
  // use Chart for immediate value
  Chart?: Function;
  // use loadChart for dynamic import (lazy-loading)
  loadChart?: PromiseOrValueLoader<Function>;
}

export default class ChartPlugin extends Plugin {
  metadata: ChartMetadata;
  loadBuildQuery?: PromiseOrValueLoader<BuildQueryFunction>;
  loadTransformProps: PromiseOrValueLoader<TransformPropsFunction>;
  loadChart: PromiseOrValueLoader<Function>;

  constructor(config: ChartPluginConfig) {
    super();
    const {
      metadata,
      buildQuery,
      loadBuildQuery,
      transformProps = IDENTITY,
      loadTransformProps,
      Chart,
      loadChart,
    } = config;
    this.metadata = metadata;
    this.loadBuildQuery = loadBuildQuery || (buildQuery ? () => buildQuery : undefined);
    this.loadTransformProps = loadTransformProps || (() => transformProps);

    if (loadChart) {
      this.loadChart = loadChart;
    } else if (Chart) {
      this.loadChart = () => Chart;
    } else {
      throw new Error('Chart or loadChart is required');
    }
  }

  register() {
    const { key = isRequired('config.key') } = this.config;
    getChartMetadataRegistry().registerValue(key, this.metadata);
    getChartBuildQueryRegistry().registerLoader(key, this.loadBuildQuery);
    getChartComponentRegistry().registerLoader(key, this.loadChart);
    getChartTransformPropsRegistry().registerLoader(key, this.loadTransformProps);

    return this;
  }

  configure(config: { [key: string]: any }, replace?: boolean) {
    super.configure(config, replace);

    return this;
  }
}
