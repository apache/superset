import Plugin from './Plugin';
import isRequired from '../../../utils/isRequired';
import { getInstance as getChartMetadataRegistry } from '../registries/ChartMetadataRegistry';
import { getInstance as getChartComponentRegistry } from '../registries/ChartComponentLoaderRegistry';
import { getInstance as getChartTransformPropsRegistry } from '../registries/ChartTransformPropsLoaderRegistry';

const IDENTITY = x => x;

export default class ChartPlugin extends Plugin {
  constructor({
    metadata,

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
    this.loadTransformProps = loadTransformProps || (() => transformProps);

    if (loadChart) {
      this.loadChart = loadChart;
    } else if (Chart) {
      this.loadChart = () => Chart;
    } else {
      throw new Error('Chart or loadChart is required');
    }
  }

  install(key = isRequired('key')) {
    this.key = key;
    getChartMetadataRegistry().register(key, this.metadata);
    getChartComponentRegistry().registerLoader(key, this.loadChart);
    getChartTransformPropsRegistry().registerLoader(key, this.loadTransformProps);
    return this;
  }
}
