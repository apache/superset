import extractQueryFields from '@superset-ui/core/src/query/extractQueryFields';

describe('extractQueryFields', () => {
  it('should return default object', () => {
    expect(extractQueryFields({})).toEqual({
      columns: [],
      groupby: [],
      metrics: [],
    });
  });

  it('should group default metric controls to metrics', () => {
    expect(extractQueryFields({ metric: 'my_metric' }).metrics).toEqual(['my_metric']);
  });

  it('should group custom metrics with default metrics', () => {
    expect(
      extractQueryFields(
        { metric: 'metric_1', my_custom_metric: 'metric_2' },
        { my_custom_metric: 'metrics' },
      ).metrics,
    ).toEqual(['metric_1', 'metric_2']);
  });

  it('should extract columns', () => {
    expect(extractQueryFields({ columns: 'col_1' })).toEqual({
      columns: ['col_1'],
      groupby: [],
      metrics: [],
    });
  });

  it('should extract groupby', () => {
    expect(extractQueryFields({ groupby: 'col_1' })).toEqual({
      columns: [],
      groupby: ['col_1'],
      metrics: [],
    });
  });

  it('should extract custom groupby', () => {
    expect(
      extractQueryFields({ series: 'col_1', metric: 'metric_1' }, { series: 'groupby' }),
    ).toEqual({
      columns: [],
      groupby: ['col_1'],
      metrics: ['metric_1'],
    });
  });

  it('should merge custom groupby with default group', () => {
    expect(
      extractQueryFields(
        { groupby: 'col_1', series: 'col_2', metric: 'metric_1' },
        { series: 'groupby' },
      ),
    ).toEqual({
      columns: [],
      groupby: ['col_1', 'col_2'],
      metrics: ['metric_1'],
    });
  });
});
