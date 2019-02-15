import { isRequired, Plugin } from '@superset-ui/core';
import ChartMetadata from './ChartMetadata';
import ChartProps from './ChartProps';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';
import { FormData } from '../types/FormData';
import { QueryContext } from '../types/Query';

const IDENTITY = (x: any) => x;

type PromiseOrValue<T> = Promise<T> | T;
type PromiseOrValueLoader<T> = () => PromiseOrValue<T> | PromiseOrValue<{ default: T }>;

export type BuildQueryFunction<T extends FormData> = (formData: T) => QueryContext;

export type TransformPropsFunction = (
  chartProps: ChartProps,
) => {
  [key: string]: any;
};

interface ChartPluginConfig<T extends FormData> {
  metadata: ChartMetadata;
  // use buildQuery for immediate value
  buildQuery?: BuildQueryFunction<T>;
  // use loadBuildQuery for dynamic import (lazy-loading)
  loadBuildQuery?: PromiseOrValueLoader<BuildQueryFunction<T>>;
  // use transformProps for immediate value
  transformProps?: TransformPropsFunction;
  // use loadTransformProps for dynamic import (lazy-loading)
  loadTransformProps?: PromiseOrValueLoader<TransformPropsFunction>;
  // use Chart for immediate value
  Chart?: Function;
  // use loadChart for dynamic import (lazy-loading)
  loadChart?: PromiseOrValueLoader<Function>;
}

export default class ChartPlugin<T extends FormData = FormData> extends Plugin {
  metadata: ChartMetadata;
  loadBuildQuery?: PromiseOrValueLoader<BuildQueryFunction<T>>;
  loadTransformProps: PromiseOrValueLoader<TransformPropsFunction>;
  loadChart: PromiseOrValueLoader<Function>;

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
