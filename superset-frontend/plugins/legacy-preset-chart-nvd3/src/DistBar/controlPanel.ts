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
import { ensureIsArray, t, validateNonEmpty } from '@superset-ui/core';
import {
  ColumnMeta,
  ControlPanelConfig,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  showLegend,
  showControls,
  xAxisLabel,
  bottomMargin,
  xTicksLayout,
  showBarValue,
  barStacked,
  reduceXTicks,
  yAxisLabel,
  yAxisShowMinmax,
  yAxisBounds,
  richTooltip,
} from '../NVD3Controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['columns'],
        ['row_limit'],
        ['timeseries_limit_metric'],
        ['order_desc'],
        [
          {
            name: 'contribution',
            config: {
              type: 'CheckboxControl',
              label: t('Contribution'),
              default: false,
              description: t('Compute the contribution to the total'),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [showLegend],
        [showBarValue],
        [richTooltip],
        [barStacked],
        [
          {
            name: 'order_bars',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Bars'),
              default: false,
              renderTrigger: true,
              description: t('Sort bars by x labels.'),
            },
          },
        ],
        ['y_axis_format'],
        [yAxisLabel],
        [showControls, null],
        [yAxisShowMinmax],
        [yAxisBounds],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        [xAxisLabel],
        [bottomMargin],
        [xTicksLayout],
        [reduceXTicks],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Series'),
      validators: [validateNonEmpty],
      mapStateToProps: (state, controlState) => {
        const groupbyProps =
          sharedControls.groupby.mapStateToProps?.(state, controlState) || {};
        groupbyProps.canDropValue = (column: ColumnMeta) =>
          !ensureIsArray(state.controls?.columns?.value).includes(
            column.column_name,
          );
        return groupbyProps;
      },
      rerender: ['columns'],
    },
    columns: {
      label: t('Breakdowns'),
      description: t('Defines how each series is broken down'),
      mapStateToProps: (state, controlState) => {
        const columnsProps =
          sharedControls.columns.mapStateToProps?.(state, controlState) || {};
        columnsProps.canDropValue = (column: ColumnMeta) =>
          !ensureIsArray(state.controls?.groupby?.value).includes(
            column.column_name,
          );
        return columnsProps;
      },
      rerender: ['groupby'],
    },
  },
};

export default config;
