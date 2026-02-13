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

import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import AgGridTableChartPlugin from '../index';
import transformProps from '../transformProps';
import { basicFormData, basicData } from './data';
import { withResizableChartDemo } from '@storybook-shared';

const VIZ_TYPE = 'ag-grid-table';

new AgGridTableChartPlugin().configure({ key: VIZ_TYPE }).register();

getChartTransformPropsRegistry().registerValue(VIZ_TYPE, transformProps);

export default {
  title: 'Chart Plugins/plugin-chart-ag-grid-table',
  decorators: [withResizableChartDemo],
  args: {
    includeSearch: true,
    showCellBars: true,
    alignPn: false,
    colorPn: true,
  },
  argTypes: {
    includeSearch: {
      control: 'boolean',
      description: 'Show search box',
    },
    showCellBars: {
      control: 'boolean',
      description: 'Show cell bars for numeric columns',
    },
    alignPn: {
      control: 'boolean',
      description: 'Align positive/negative values',
    },
    colorPn: {
      control: 'boolean',
      description: 'Color positive/negative values',
    },
  },
};

export const Basic = ({
  includeSearch,
  showCellBars,
  alignPn,
  colorPn,
  width,
  height,
}: {
  includeSearch: boolean;
  showCellBars: boolean;
  alignPn: boolean;
  colorPn: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType={VIZ_TYPE}
    width={width}
    height={height}
    datasource={{
      columnFormats: {},
      verboseMap: {},
    }}
    queriesData={[basicData]}
    formData={{
      ...basicFormData,
      include_search: includeSearch,
      show_cell_bars: showCellBars,
      align_pn: alignPn,
      color_pn: colorPn,
    }}
  />
);

Basic.parameters = {
  initialSize: {
    width: 680,
    height: 420,
  },
};
