import {
  ChartMetadata,
  ChartPlugin,
  ChartProps,
  createLoadableRenderer,
  getChartBuildQueryRegistry,
  getChartComponentRegistry,
  getChartMetadataRegistry,
  getChartTransformPropsRegistry,
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
    ].forEach(x => expect(x).toBeDefined());
  });
});
