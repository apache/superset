import Plugin from '../../platform/Plugin';
import * as BuildQuery from '../registries/BuildQueryRegistry';
import * as ChartMetadataRegistry from '../registries/ChartMetadataRegistry';
import * as ChartRegistry from '../registries/ChartRegistry';
import * as TransformPropsRegistry from '../registries/TransformPropsRegistry';

const IDENTITY = x => x;

export default class ChartPlugin extends Plugin {
  constructor({
    key,
    metadata,

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
    super(key);
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

  install(key = this.key) {
    super.setInstalledKey(key);
    BuildQuery.registerLoader(key, this.loadBuildQuery);
    ChartMetadataRegistry.register(key, this.metadata);
    ChartRegistry.registerLoader(key, this.loadChart);
    TransformPropsRegistry.registerLoader(key, this.loadTransformProps);
  }
}
