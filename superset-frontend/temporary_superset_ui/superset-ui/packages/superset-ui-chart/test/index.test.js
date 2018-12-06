import {
  ChartMetadata,
  ChartPlugin,
  ChartProps,
  createLoadableRenderer,
  getChartBuildQueryRegistry,
  getChartComponentRegistry,
  getChartMetadataRegistry,
  getChartTransformPropsRegistry,
  reactify,
} from '../src/index';

describe('index', () => {
  it('exports modules', () => {
    [
      ChartMetadata,
      ChartPlugin,
      ChartProps,
      createLoadableRenderer,
      getChartBuildQueryRegistry,
      getChartComponentRegistry,
      getChartMetadataRegistry,
      getChartTransformPropsRegistry,
      reactify,
    ].forEach(x => expect(x).toBeDefined());
  });
});
