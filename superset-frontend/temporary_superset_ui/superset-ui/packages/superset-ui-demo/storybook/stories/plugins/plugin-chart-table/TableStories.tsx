import React from 'react';
import memoizeOne from 'memoize-one';
import { withKnobs, number, boolean } from '@storybook/addon-knobs';
import { SuperChart } from '@superset-ui/chart';
import TableChartPlugin, { TableChartProps } from '@superset-ui/plugin-chart-table';
import { basicFormData, basicData, birthNames } from './testData';
import { withResizableChartDemo } from '../../../shared/components/ResizableChartDemo';

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-table',
  decorators: [withKnobs, withResizableChartDemo],
};

new TableChartPlugin().configure({ key: 'table' }).register();

function expandArray<T>(input: T[], targetSize: number) {
  if (!input || input.length === 0) {
    throw new Error('Cannot expand an empty array');
  }
  let arr = input;
  while (arr.length < targetSize) {
    arr = arr.concat(arr);
  }
  return arr.slice(0, targetSize);
}

// memoize expanded array so to make sure we always return the same
// data when changing page sizes
const expandRecords = memoizeOne(expandArray);
const expandColumns = memoizeOne(expandArray);

/**
 * Load sample data for testing
 * @param props the original props passed to SuperChart
 * @param pageLength number of records perpage
 * @param rows the target number of records
 * @param cols the target number of columns
 */
function loadData(
  props: TableChartProps,
  { pageLength = 50, rows = 1042, cols = 8, alignPn = false, showCellBars = true },
): TableChartProps {
  if (!props.queryData) return props;
  const records = props.queryData?.data?.records || [];
  const columns = props.queryData?.data?.columns || [];
  return {
    ...props,
    queryData: {
      ...props.queryData,
      data: {
        records: expandRecords(records, rows),
        columns: expandColumns(columns, cols),
      },
    },
    formData: {
      ...props.formData,
      alignPn,
      pageLength,
      showCellBars,
    },
    height: window.innerHeight - 130,
  };
}

export const basic = ({ width, height }) => (
  <SuperChart
    chartType="table"
    datasource={{
      columnFormats: {},
    }}
    width={width}
    height={height}
    queryData={{ data: basicData }}
    formData={basicFormData}
  />
);
basic.story = {
  parameters: {
    initialSize: {
      width: 680,
      height: 420,
    },
  },
};

export const BigTable = ({ width, height }) => {
  const rows = number('Records', 2046, { range: true, min: 0, max: 50000 });
  const cols = number('Columns', 8, { range: true, min: 1, max: 20 });
  const pageLength = number('Page size', 50, { range: true, min: 0, max: 100 });
  const alignPn = boolean('Algin PosNeg', false);
  const showCellBars = boolean('Show Cell Bars', true);
  const chartProps = loadData(birthNames, { pageLength, rows, cols, alignPn, showCellBars });
  return <SuperChart chartType="table" {...chartProps} width={width} height={height} />;
};
BigTable.story = {
  parameters: {
    initialSize: {
      width: 620,
      height: 440,
    },
  },
};
