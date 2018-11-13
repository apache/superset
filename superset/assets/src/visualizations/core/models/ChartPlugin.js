import Plugin from './Plugin';
import isRequired from '../../../utils/isRequired';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';

const IDENTITY = x => x;

export default class ChartPlugin extends Plugin {
  constructor({
    metadata = isRequired('metadata'),

    // use buildQuery for immediate value
    buildQuery = IDENTITY,
    // use loadBuildQuery for dynamic import (lazy-loading)
    loadBuildQuery,

    // use transformProps for immediate value
    transformProps = IDENTITY,
    // use loadTransformProps for dynamic import (lazy-loading)
    loadTransformProps,

    // use Chart for immediate value
    Chart,
    // use loadChart for dynamic import (lazy-loading)
    loadChart,
  } = {}) {
    super();
    this.metadata = metadata;
    this.loadBuildQuery = loadBuildQuery || (() => buildQuery);
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
}
