import buildQuery from '../../src/plugin/buildQuery';

describe('PivotTableChart buildQuery', () => {
  const formData = {
    groupbyRows: ['row1', 'row2'],
    groupbyColumns: ['col1', 'col2'],
    metrics: ['metric1', 'metric2'],
    tableRenderer: 'Table With Subtotal',
    colOrder: 'key_a_to_z',
    rowOrder: 'key_a_to_z',
    aggregateFunction: 'Sum',
    transposePivot: true,
    rowSubtotalPosition: true,
    colSubtotalPosition: true,
    colTotals: true,
    rowTotals: true,
    valueFormat: 'SMART_NUMBER',
    datasource: '5__table',
    viz_type: 'my_chart',
    width: 800,
    height: 600,
    combineMetric: false,
    verboseMap: {},
    columnFormats: {},
    metricColorFormatters: [],
    dateFormatters: {},
    setDataMask: () => {},
  };

  it('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['col1', 'col2', 'row1', 'row2']);
  });
});
