import {
  SuperChart,
  ChartFrame,
  CategoricalColorScale,
  SupersetClient,
  Registry,
  getTextDimension,
  getNumberFormatterRegistry,
  buildQueryContext,
  getTimeFormatterRegistry,
  t,
} from '../src';

describe('@superset-ui/superset-ui', () => {
  it('it should export @superset-ui/core', () => {
    expect(Registry).toBeDefined();
  });
  it('should export @superset-ui/chart', () => {
    expect(SuperChart).toBeDefined();
  });
  it('should export @superset-ui/chart-composition', () => {
    expect(ChartFrame).toBeDefined();
  });
  it('should export @superset-ui/color', () => {
    expect(CategoricalColorScale).toBeDefined();
  });
  it('should export @superset-ui/connection', () => {
    expect(SupersetClient).toBeDefined();
  });
  it('should export @superset-ui/core', () => {
    expect(Registry).toBeDefined();
  });
  it('should export @superset-ui/dimension', () => {
    expect(getTextDimension).toBeDefined();
  });
  it('should export @superset-ui/number-format', () => {
    expect(getNumberFormatterRegistry).toBeDefined();
  });
  it('should export @superset-ui/query', () => {
    expect(buildQueryContext).toBeDefined();
  });
  it('should export @superset-ui/time-format', () => {
    expect(getTimeFormatterRegistry).toBeDefined();
  });
  it('should export @superset-ui/translation', () => {
    expect(t).toBeDefined();
  });
});
