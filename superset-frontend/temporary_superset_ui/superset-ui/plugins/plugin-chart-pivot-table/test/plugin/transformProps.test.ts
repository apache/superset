import { ChartProps, QueryFormData } from '@superset-ui/core';
import transformProps from '../../src/plugin/transformProps';
import { MetricsLayoutEnum } from '../../src/types';

describe('PivotTableChart transformProps', () => {
  const setDataMask = jest.fn();
  const formData = {
    groupbyRows: ['row1', 'row2'],
    groupbyColumns: ['col1', 'col2'],
    metrics: ['metric1', 'metric2'],
    tableRenderer: 'Table With Subtotal',
    colOrder: 'key_a_to_z',
    rowOrder: 'key_a_to_z',
    aggregateFunction: 'Sum',
    transposePivot: true,
    combineMetric: true,
    rowSubtotalPosition: true,
    colSubtotalPosition: true,
    colTotals: true,
    rowTotals: true,
    valueFormat: 'SMART_NUMBER',
    emitFilter: false,
    metricsLayout: MetricsLayoutEnum.COLUMNS,
    viz_type: '',
    datasource: '',
    conditionalFormatting: [],
    dateFormat: '',
  };
  const chartProps = new ChartProps<QueryFormData>({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
        colnames: ['name', 'sum__num', '__timestamp'],
        coltypes: [1, 0, 2],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
  });

  it('should transform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual({
      width: 800,
      height: 600,
      groupbyRows: ['row1', 'row2'],
      groupbyColumns: ['col1', 'col2'],
      metrics: ['metric1', 'metric2'],
      tableRenderer: 'Table With Subtotal',
      colOrder: 'key_a_to_z',
      rowOrder: 'key_a_to_z',
      aggregateFunction: 'Sum',
      transposePivot: true,
      combineMetric: true,
      rowSubtotalPosition: true,
      colSubtotalPosition: true,
      colTotals: true,
      rowTotals: true,
      valueFormat: 'SMART_NUMBER',
      data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
      emitFilter: false,
      setDataMask,
      selectedFilters: {},
      verboseMap: {},
      metricsLayout: MetricsLayoutEnum.COLUMNS,
      metricColorFormatters: [],
      dateFormatters: {},
      columnFormats: {},
    });
  });
});
