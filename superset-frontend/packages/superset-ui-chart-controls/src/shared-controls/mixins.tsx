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
  ensureIsArray,
  hasGenericChartAxes,
  NO_TIME_RANGE,
  QueryFormData,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import { BaseControlConfig, ControlPanelState, ControlState } from '../types';
import { getTemporalColumns } from '../utils';

const getAxisLabel = (
  formData: QueryFormData,
): Record<'label' | 'description', string> =>
  formData?.orientation === 'horizontal'
    ? { label: t('Y-axis'), description: t('Dimension to use on y-axis.') }
    : { label: t('X-axis'), description: t('Dimension to use on x-axis.') };

export const xAxisMixin = {
  label: (state: ControlPanelState) => getAxisLabel(state?.form_data).label,
  multi: false,
  description: (state: ControlPanelState) =>
    getAxisLabel(state?.form_data).description,
  validators: [validateNonEmpty],
  initialValue: (control: ControlState, state: ControlPanelState | null) => {
    if (
      hasGenericChartAxes &&
      state?.form_data?.granularity_sqla &&
      !state.form_data?.x_axis &&
      !control?.value
    ) {
      return state.form_data.granularity_sqla;
    }
    return undefined;
  },
  default: undefined,
};

export const temporalColumnMixin: Pick<BaseControlConfig, 'mapStateToProps'> = {
  mapStateToProps: ({ datasource }) => {
    const payload = getTemporalColumns(datasource);

    return {
      options: payload.temporalColumns,
      default: payload.defaultTemporalColumn,
      isTemporal: true,
    };
  },
};

export const datePickerInAdhocFilterMixin: Pick<
  BaseControlConfig,
  'initialValue'
> = {
  initialValue: (control: ControlState, state: ControlPanelState | null) => {
    // skip initialValue if
    // 1) GENERIC_CHART_AXES is disabled
    // 2) the time_range control is present (this is the case for legacy charts)
    // 3) there was a time filter in adhoc filters
    if (
      !hasGenericChartAxes ||
      state?.controls?.time_range?.value ||
      ensureIsArray(control.value).findIndex(
        (flt: any) => flt?.operator === 'TEMPORAL_RANGE',
      ) > -1
    ) {
      return undefined;
    }

    // should migrate original granularity_sqla and time_range into adhoc filter
    // 1) granularity_sqla and time_range are existed
    if (state?.form_data?.granularity_sqla && state?.form_data?.time_range) {
      return [
        ...ensureIsArray(control.value),
        {
          clause: 'WHERE',
          subject: state.form_data.granularity_sqla,
          operator: 'TEMPORAL_RANGE',
          comparator: state.form_data.time_range,
          expressionType: 'SIMPLE',
        },
      ];
    }

    // should apply the default time filter into adhoc filter
    // 1) temporal column is existed in current datasource
    const temporalColumn =
      state?.datasource &&
      getTemporalColumns(state.datasource).defaultTemporalColumn;
    if (hasGenericChartAxes && temporalColumn) {
      return [
        ...ensureIsArray(control.value),
        {
          clause: 'WHERE',
          subject: temporalColumn,
          operator: 'TEMPORAL_RANGE',
          comparator: state?.common?.conf?.DEFAULT_TIME_FILTER || NO_TIME_RANGE,
          expressionType: 'SIMPLE',
        },
      ];
    }

    return undefined;
  },
};
