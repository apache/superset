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
} from '@superset-ui/core/src/chart';

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
