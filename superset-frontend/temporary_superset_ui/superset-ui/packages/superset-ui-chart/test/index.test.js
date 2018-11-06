import {
  ChartMetadata,
  ChartPlugin,
  ChartProps,
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
      getChartBuildQueryRegistry,
      getChartComponentRegistry,
      getChartMetadataRegistry,
      getChartTransformPropsRegistry,
    ].forEach(x => expect(x).toBeDefined());
  });
});
