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
import {
  ControlPanelState,
  ControlSetItem,
  ControlState,
  sharedControls,
  Dataset,
  ColumnMeta,
  defineSavedMetrics,
} from '@superset-ui/chart-controls';
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import { getQueryMode, isAggMode, validateAggControlValues } from './shared';

const percentMetrics: typeof sharedControls.metrics = {
  type: 'MetricsControl',
  label: t('Percentage metrics'),
  description: t(
    'Metrics for which percentage of total are to be displayed. Calculated from only data within the row limit.',
  ),
  multi: true,
  visibility: isAggMode,
  resetOnHide: false,
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    columns: datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    datasource,
    datasourceType: datasource?.type,
    queryMode: getQueryMode(controls),
    externalValidationErrors: validateAggControlValues(controls, [
      controls.groupby?.value,
      controls.metrics?.value,
      controlState.value,
    ]),
  }),
  rerender: ['groupby', 'metrics'],
  default: [],
  validators: [],
};

const dndPercentMetrics = {
  ...percentMetrics,
  type: 'DndMetricSelect',
};

export const percentMetricsControlSetItem: ControlSetItem = {
  name: 'percent_metrics',
  config: {
    ...(isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
      ? dndPercentMetrics
      : percentMetrics),
  },
};

export const metricsControlSetItem: ControlSetItem = {
  name: 'metrics',
  override: {
    validators: [],
    visibility: isAggMode,
    mapStateToProps: (
      { controls, datasource, form_data }: ControlPanelState,
      controlState: ControlState,
    ) => ({
      columns: datasource?.columns[0]?.hasOwnProperty('filterable')
        ? (datasource as Dataset)?.columns?.filter(
            (c: ColumnMeta) => c.filterable,
          )
        : datasource?.columns,
      savedMetrics: defineSavedMetrics(datasource),
      // current active adhoc metrics
      selectedMetrics:
        form_data.metrics || (form_data.metric ? [form_data.metric] : []),
      datasource,
      externalValidationErrors: validateAggControlValues(controls, [
        controls.groupby?.value,
        controls.percent_metrics?.value,
        controlState.value,
      ]),
    }),
    rerender: ['groupby', 'percent_metrics'],
    resetOnHide: false,
  },
};

export const showTotalsControlSetItem: ControlSetItem = {
  name: 'show_totals',
  config: {
    type: 'CheckboxControl',
    label: t('Show totals'),
    default: false,
    description: t(
      'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
    ),
    visibility: isAggMode,
    resetOnHide: false,
  },
};
