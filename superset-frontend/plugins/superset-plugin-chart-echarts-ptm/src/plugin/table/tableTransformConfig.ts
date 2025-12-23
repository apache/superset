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

import { t } from '@superset-ui/core';
import { ControlSetRow } from '@superset-ui/chart-controls';
import type { TransformConfig } from '../../shared/transformHelpers';

export const TABLE_TRANSFORM_CONFIG: TransformConfig = {
  defaults: true,
  seriesType: false,
  dataZoom: false,
  colorPalette: true,
  pillFormat: true,
  userOverrides: true,
};

export const tablePillColumnsControl: ControlSetRow = [
  {
    name: 'ptm_pill_columns',
    config: {
      type: 'SelectControl',
      label: t('Pill Columns'),
      description: t(
        'Select columns to style as colorful pills. Useful for categorical text values.'
      ),
      multi: true,
      freeForm: true,
      default: [],
      renderTrigger: true,
      shouldMapStateToProps() {
        return true;
      },
      mapStateToProps: (explore: any, controlState: any, chart: any) => {
        const { colnames } = chart?.queriesResponse?.[0] ?? {};
        
        if (colnames && colnames.length > 0) {
          const choices = colnames.map((col: string) => [col, col]);
          return { choices };
        }
        
        const groupby = explore.controls?.groupby?.value || [];
        const metrics = explore.controls?.metrics?.value || [];
        const percentMetrics = explore.controls?.percent_metrics?.value || [];
        
        const columnNames = [
          ...groupby.map((col: any) => col.column_name || col.label || col),
          ...metrics.map((m: any) => m.label || m),
          ...percentMetrics.map((m: any) => m.label || m),
        ].filter(Boolean);
        
        const choices = columnNames.map((col: string) => [col, col]);
        
        return { choices };
      },
    },
  },
];

