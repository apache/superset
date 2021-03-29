import React from 'react';
import memoizeOne from 'memoize-one';
import { withKnobs, number, boolean } from '@storybook/addon-knobs';
import { SuperChart } from '@superset-ui/core';
import TableChartPlugin, { TableChartProps } from '@superset-ui/plugin-chart-table/src';
import { basicFormData, basicData, birthNames } from './testData';
import { withResizableChartDemo } from '../../../shared/components/ResizableChartDemo';

export default {
  title: 'Chart Plugins|plugin-chart-table',
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
  {
    pageLength = 50,
    rows = 1042,
    cols = 8,
    alignPn = false,
    showCellBars = true,
    includeSearch = true,
  },
): TableChartProps {
  if (!props.queriesData || !props.queriesData[0]) return props;
  const records = props.queriesData?.[0].data || [];
  const columns = props.queriesData?.[0].colnames || [];
  return {
    ...props,
    queriesData: [
      {
        ...props.queriesData[0],
        data: expandRecords(records, rows),
        colnames: expandColumns(columns, cols),
      },
    ],
    formData: {
      ...props.formData,
      align_pn: alignPn,
      page_length: pageLength,
      show_cell_bars: showCellBars,
      include_search: includeSearch,
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
    queriesData={[basicData]}
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
  const includeSearch = boolean('Include search', true);
  const alignPn = boolean('Algin PosNeg', false);
  const showCellBars = boolean('Show Cell Bars', true);
  const chartProps = loadData(birthNames, {
    pageLength,
    rows,
    cols,
    alignPn,
    showCellBars,
    includeSearch,
  });
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
