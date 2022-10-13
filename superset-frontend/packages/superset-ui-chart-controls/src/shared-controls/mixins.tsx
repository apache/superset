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
  hasGenericChartAxes,
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
