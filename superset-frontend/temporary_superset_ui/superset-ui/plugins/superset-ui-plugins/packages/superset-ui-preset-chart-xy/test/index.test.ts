import {
  LegacyScatterPlotChartPlugin,
  ScatterPlotChartPlugin,
  LegacyLineChartPlugin,
  LineChartPlugin,
  LegacyBoxPlotChartPlugin,
  BoxPlotChartPlugin,
} from '../src';

describe('index', () => {
  it('exports ScatterPlot', () => {
    expect(ScatterPlotChartPlugin).toBeDefined();
  });
  it('exports Line', () => {
    expect(LineChartPlugin).toBeDefined();
  });
  it('exports BoxPlot', () => {
    expect(BoxPlotChartPlugin).toBeDefined();
  });
  it('exports legacy ScatterPlot', () => {
    expect(LegacyScatterPlotChartPlugin).toBeDefined();
  });
  it('exports legacy Line', () => {
    expect(LegacyLineChartPlugin).toBeDefined();
  });
  it('exports legacy BoxPlot', () => {
    expect(LegacyBoxPlotChartPlugin).toBeDefined();
  });
});
