import { WordCloudChartPlugin, LegacyWordCloudChartPlugin } from '../src';

describe('plugin-chart-word-cloud', () => {
  it('exports WordCloudChartPlugin', () => {
    expect(WordCloudChartPlugin).toBeDefined();
  });
  it('exports LegacyWordCloudChartPlugin', () => {
    expect(LegacyWordCloudChartPlugin).toBeDefined();
  });
});
