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
import { Dispatch } from 'redux';
import { makeApi, CategoricalColorNamespace } from '@superset-ui/core';
import { isString } from 'lodash';
import { ChartConfiguration, DashboardInfo } from '../reducers/types';

export const DASHBOARD_INFO_UPDATED = 'DASHBOARD_INFO_UPDATED';

// updates partially changed dashboard info
export function dashboardInfoChanged(newInfo: { metadata: any }) {
  const { metadata } = newInfo;

  const categoricalNamespace = CategoricalColorNamespace.getNamespace(
    metadata?.color_namespace,
  );

  categoricalNamespace.resetColors();

  if (metadata?.label_colors) {
    const labelColors = metadata.label_colors;
    const colorMap = isString(labelColors)
      ? JSON.parse(labelColors)
      : labelColors;
    Object.keys(colorMap).forEach(label => {
      categoricalNamespace.setColor(label, colorMap[label]);
    });
  }

  return { type: DASHBOARD_INFO_UPDATED, newInfo };
}
export const SET_CHART_CONFIG_BEGIN = 'SET_CHART_CONFIG_BEGIN';
export interface SetChartConfigBegin {
  type: typeof SET_CHART_CONFIG_BEGIN;
  chartConfiguration: ChartConfiguration;
}
export const SET_CHART_CONFIG_COMPLETE = 'SET_CHART_CONFIG_COMPLETE';
export interface SetChartConfigComplete {
  type: typeof SET_CHART_CONFIG_COMPLETE;
  chartConfiguration: ChartConfiguration;
}
export const SET_CHART_CONFIG_FAIL = 'SET_CHART_CONFIG_FAIL';
export interface SetChartConfigFail {
  type: typeof SET_CHART_CONFIG_FAIL;
  chartConfiguration: ChartConfiguration;
}
export const setChartConfiguration = (
  chartConfiguration: ChartConfiguration,
) => async (dispatch: Dispatch, getState: () => any) => {
  dispatch({
    type: SET_CHART_CONFIG_BEGIN,
    chartConfiguration,
  });
  const { id, metadata } = getState().dashboardInfo;

  // TODO extract this out when makeApi supports url parameters
  const updateDashboard = makeApi<
    Partial<DashboardInfo>,
    { result: DashboardInfo }
  >({
    method: 'PUT',
    endpoint: `/api/v1/dashboard/${id}`,
  });

  try {
    const response = await updateDashboard({
      json_metadata: JSON.stringify({
        ...metadata,
        chart_configuration: chartConfiguration,
      }),
    });
    dispatch(
      dashboardInfoChanged({
        metadata: JSON.parse(response.result.json_metadata),
      }),
    );
    dispatch({
      type: SET_CHART_CONFIG_COMPLETE,
      chartConfiguration,
    });
  } catch (err) {
    dispatch({ type: SET_CHART_CONFIG_FAIL, chartConfiguration });
  }
};
