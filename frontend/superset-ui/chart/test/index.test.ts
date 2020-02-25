import {
  ChartClient,
  ChartMetadata,
  ChartPlugin,
  ChartProps,
  createLoadableRenderer,
  getChartBuildQueryRegistry,
  getChartComponentRegistry,
  getChartControlPanelRegistry,
  getChartMetadataRegistry,
  getChartTransformPropsRegistry,
  reactify,
} from '../src';

describe('index', () => {
  it('exports modules', () => {
    [
      ChartClient,
      ChartMetadata,
      ChartPlugin,
      ChartProps,
      createLoadableRenderer,
      getChartBuildQueryRegistry,
      getChartComponentRegistry,
      getChartControlPanelRegistry,
      getChartMetadataRegistry,
      getChartTransformPropsRegistry,
      reactify,
    ].forEach(x => expect(x).toBeDefined());
  });
});
