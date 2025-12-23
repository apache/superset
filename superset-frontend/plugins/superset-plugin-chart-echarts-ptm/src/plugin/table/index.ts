/**
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
import { ChartProps } from '@superset-ui/core';
import { createPtmPlugin } from '../../shared';
import { applyPillFormatting } from './pillFormat';
import { TABLE_TRANSFORM_CONFIG, tablePillColumnsControl } from './tableTransformConfig';
import thumbnail from './images/thumbnail.png';

// Import from original table plugin source (same monorepo)
// @ts-ignore - importing from external source directory
import TableTransformProps from '../../../../plugin-chart-table/src/transformProps';
// @ts-ignore - importing from external source directory
import TableBuildQuery from '../../../../plugin-chart-table/src/buildQuery';
// @ts-ignore - importing from external source directory
import TableControlPanel from '../../../../plugin-chart-table/src/controlPanel';
import TableChartPTM from './TableChartPTM';

const TABLE_PTM_DEFAULTS = {};

function wrapTableTransformProps(baseTransformProps: (chartProps: ChartProps) => any) {
  return (chartProps: ChartProps) => {
    const result = baseTransformProps(chartProps);
    const { formData } = chartProps;
    
    if (result.data && result.columns) {
      result.data = applyPillFormatting(result.data, result.columns, formData);
    }
    
    return result;
  };
}

const PtmTableChartPlugin = createPtmPlugin({
  name: 'Table PTM',
  description: 'Table with PTM styling. Clean, minimal design with Inter font, optional pills for categorical values.',
  category: 'Table',
  tags: ['Table', 'Tabular', 'Data', 'PTM'],
  thumbnail,
  base: {
    buildQuery: TableBuildQuery,
    transformProps: wrapTableTransformProps(TableTransformProps as any) as any,
    controlPanel: TableControlPanel,
    Chart: TableChartPTM as any,
  },
  transforms: TABLE_TRANSFORM_CONFIG,
  ptmDefaults: TABLE_PTM_DEFAULTS,
  additionalPtmControls: [tablePillColumnsControl],
});

export default PtmTableChartPlugin;
export { default as TableStyles } from './Styles';
