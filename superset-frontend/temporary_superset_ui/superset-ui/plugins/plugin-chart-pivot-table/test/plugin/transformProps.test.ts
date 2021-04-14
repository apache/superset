import { ChartProps } from '@superset-ui/core';
import transformProps from '../../src/plugin/transformProps';

describe('PivotTableChart transformProps', () => {
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
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
      },
    ],
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
      rowSubtotalPosition: true,
      colSubtotalPosition: true,
      colTotals: true,
      rowTotals: true,
      valueFormat: 'SMART_NUMBER',
      data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
    });
  });
});
