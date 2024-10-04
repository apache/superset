/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import memoizeOne from 'memoize-one';
import { SuperChart } from '@superset-ui/core';
import TableChartPlugin, {
  TableChartProps,
} from '@superset-ui/plugin-chart-table';
import { basicFormData, basicData, birthNames } from './testData';
import { withResizableChartDemo } from '../../../shared/components/ResizableChartDemo';

export default {
  title: 'Chart Plugins/plugin-chart-table',
  decorators: [withResizableChartDemo],
  args: {
    rows: 2046,
    cols: 8,
    pageLength: 50,
    includeSearch: true,
    alignPn: false,
    showCellBars: true,
    allowRearrangeColumns: false,
  },
  argTypes: {
    rows: {
      control: 'number',
      name: 'Records',
      min: 0,
      max: 50000,
    },
    cols: {
      control: 'number',
      name: 'Columns',
      min: 1,
      max: 20,
    },
    pageLength: {
      control: 'number',
      name: 'Page size',
      min: 0,
      max: 100,
    },
    includeSearch: {
      control: 'boolean',
      name: 'Include search',
    },
    alignPn: {
      control: 'boolean',
      name: 'Align PosNeg',
    },
    showCellBars: {
      control: 'boolean',
      name: 'Show Cell Bars',
    },
    allowRearrangeColumns: {
      control: 'boolean',
      name: 'Allow end user to drag-and-drop column headers to rearrange them.',
    },
  },
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
 * @param pageLength number of records per page
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
    allowRearrangeColumns = false,
  },
): TableChartProps {
  if (!props.queriesData?.[0]) return props;
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
      allow_rearrange_columns: allowRearrangeColumns,
    },
    height: window.innerHeight - 130,
  };
}

export const Basic = ({ width, height }) => (
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
Basic.parameters = {
  initialSize: {
    width: 680,
    height: 420,
  },
};

export const BigTable = (
  {
    rows,
    cols,
    pageLength,
    includeSearch,
    alignPn,
    showCellBars,
    allowRearrangeColumns,
  }: {
    rows: number;
    cols: number;
    pageLength: number;
    includeSearch: boolean;
    alignPn: boolean;
    showCellBars: boolean;
    allowRearrangeColumns: boolean;
  },
  { width, height }: { width: number; height: number },
) => {
  const chartProps = loadData(birthNames, {
    pageLength,
    rows,
    cols,
    alignPn,
    showCellBars,
    includeSearch,
    allowRearrangeColumns,
  });
  return (
    <SuperChart
      chartType="table"
      {...chartProps}
      width={width}
      height={height}
    />
  );
};
BigTable.parameters = {
  initialSize: {
    width: 620,
    height: 440,
  },
};
