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
  FeatureFlag,
  isDefined,
  isFeatureEnabled,
  QueryColumn,
  QueryFormData,
  t,
  validateNonEmpty,
  ValueOf,
} from '@superset-ui/core';
import {
  BaseControlConfig,
  ColumnMeta,
  ControlPanelState,
  ControlState,
  isColumnMeta,
  isDataset,
  isQueryResponse,
} from '../types';

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
  initialValue: (control: ControlState, state: ControlPanelState) => {
    if (
      isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES) &&
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

export const getTemporalColumnsFromDatasouce = (
  datasource: ValueOf<Pick<ControlPanelState, 'datasource'>>,
) => {
  const rv: {
    temporalColumns: ColumnMeta[] | QueryColumn[];
    defaultTemporalColumn: string | null | undefined;
  } = {
    temporalColumns: [],
    defaultTemporalColumn: undefined,
  };

  if (
    isDataset(datasource) ||
    (isQueryResponse(datasource) && !('results' in datasource))
  ) {
    rv.temporalColumns = ensureIsArray(datasource.columns).filter(
      c => c.is_dttm,
    );
  }
  if (isQueryResponse(datasource) && 'results' in datasource) {
    rv.temporalColumns = ensureIsArray(datasource.results.columns).filter(
      c => c.is_dttm,
    );
  }

  if (isDataset(datasource)) {
    rv.defaultTemporalColumn = datasource.main_dttm_col;
  }
  if (!isDefined(rv.defaultTemporalColumn)) {
    rv.defaultTemporalColumn = isColumnMeta(rv.temporalColumns[0])
      ? rv.temporalColumns[0].column_name
      : rv.temporalColumns[0]?.name;
  }

  return rv;
};

export const temporalColumnMixin: Pick<BaseControlConfig, 'mapStateToProps'> = {
  mapStateToProps: ({ datasource }) => {
    const payload = getTemporalColumnsFromDatasouce(datasource);

    return {
      options: payload.temporalColumns,
      default: payload.defaultTemporalColumn,
      isTemporal: true,
    };
  },
};
