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
import { isEmpty, intersection } from 'lodash';
import {
  ensureIsArray,
  getChartControlPanelRegistry,
  QueryFormData,
} from '@superset-ui/core';
import {
  ControlStateMapping,
  StandardizedState,
  StandardizedFormDataInterface,
} from '@superset-ui/chart-controls';
import { getControlsState } from 'src/explore/store';
import { getFormDataFromControls } from './getFormDataFromControls';

export const sharedControls: Record<string, keyof StandardizedState> = {
  // metrics
  metric: 'metrics', // via sharedControls, scalar
  metrics: 'metrics', // via sharedControls, array
  metric_2: 'metrics', // via sharedControls, scalar
  // columns
  groupby: 'columns', // via sharedControls, array
  columns: 'columns', // via sharedControls, array
  groupbyColumns: 'columns', // via pivot table v2, array
  groupbyRows: 'columns', // via pivot table v2, array
};
const sharedControlsMap: Record<keyof StandardizedState, string[]> = {
  metrics: [],
  columns: [],
};
Object.entries(sharedControls).forEach(([key, value]) =>
  sharedControlsMap[value].push(key),
);
export const publicControls = [
  // time section
  'granularity_sqla', // via sharedControls
  'time_grain_sqla', // via sharedControls
  'time_range', // via sharedControls
  // filters
  'adhoc_filters', // via sharedControls
  // subquery limit(series limit)
  'limit', // via sharedControls
  // order by clause
  'timeseries_limit_metric', // via sharedControls
  'series_limit_metric', // via sharedControls
  // desc or asc in order by clause
  'order_desc', // via sharedControls
  // outer query limit
  'row_limit', // via sharedControls
  // x asxs column
  'x_axis', // via sharedControls
  // advanced analytics - rolling window
  'rolling_type', // via sections.advancedAnalytics
  'rolling_periods', // via sections.advancedAnalytics
  'min_periods', // via sections.advancedAnalytics
  // advanced analytics - time comparison
  'time_compare', // via sections.advancedAnalytics
  'comparison_type', // via sections.advancedAnalytics
  // advanced analytics - resample
  'resample_rule', // via sections.advancedAnalytics
  'resample_method', // via sections.advancedAnalytics
];

export class StandardizedFormData {
  private sfd: StandardizedFormDataInterface;

  constructor(sourceFormData: QueryFormData) {
    /*
     * Support form_data for smooth switching between different viz
     * */
    const formData = Object.freeze(sourceFormData);

    // generates an ordered map, the key is viz_type and the value is form_data. the last item is current viz
    const memorizedFormData: Map<string, QueryFormData> = Array.isArray(
      formData?.standardizedFormData?.memorizedFormData,
    )
      ? new Map(formData.standardizedFormData.memorizedFormData)
      : new Map();
    const vizType = formData.viz_type;
    if (memorizedFormData.has(vizType)) {
      memorizedFormData.delete(vizType);
    }
    memorizedFormData.set(vizType, formData);

    // calculate sharedControls
    const standardizedState =
      StandardizedFormData.getStandardizedState(formData);

    this.sfd = {
      standardizedState,
      memorizedFormData,
    };
  }

  static getStandardizedState(formData: QueryFormData): StandardizedState {
    // 1. collect current sharedControls
    let currState: StandardizedState = {
      metrics: [],
      columns: [],
    };
    Object.entries(formData).forEach(([key, value]) => {
      if (key in sharedControls) {
        currState[sharedControls[key]].push(...ensureIsArray(value));
      }
    });

    // 2. get previous StandardizedState
    let prevState: StandardizedState = {
      metrics: [],
      columns: [],
    };
    if (
      formData?.standardizedFormData?.standardizedState &&
      Array.isArray(formData.standardizedFormData.standardizedState.metrics) &&
      Array.isArray(formData.standardizedFormData.standardizedState.columns)
    ) {
      prevState = formData.standardizedFormData.standardizedState;
    }
    // the initial prevState should equal to currentState
    if (isEmpty(prevState.metrics) && isEmpty(prevState.columns)) {
      prevState = currState;
    }

    // 3. inherit SS from previous state if current viz hasn't columns-like controls or metrics-like controls
    Object.keys(sharedControlsMap).forEach(key => {
      if (
        isEmpty(intersection(Object.keys(formData), sharedControlsMap[key]))
      ) {
        currState[key] = prevState[key];
      }
    });

    // 4. update hook
    const controlPanel = getChartControlPanelRegistry().get(formData.viz_type);
    if (controlPanel?.updateStandardizedState) {
      currState = controlPanel.updateStandardizedState(prevState, currState);
    }

    // 5. clear up
    Object.entries(currState).forEach(([key, value]) => {
      currState[key] = value.filter(Boolean);
    });

    return currState;
  }

  private getLatestFormData(vizType: string): QueryFormData {
    if (this.has(vizType)) {
      return this.get(vizType);
    }

    return this.memorizedFormData.slice(-1)[0][1];
  }

  private get standardizedState() {
    return this.sfd.standardizedState;
  }

  private get memorizedFormData() {
    return Array.from(this.sfd.memorizedFormData.entries());
  }

  serialize() {
    return {
      standardizedState: this.standardizedState,
      memorizedFormData: this.memorizedFormData,
    };
  }

  has(vizType: string): boolean {
    return this.sfd.memorizedFormData.has(vizType);
  }

  get(vizType: string): QueryFormData {
    return this.sfd.memorizedFormData.get(vizType) as QueryFormData;
  }

  transform(
    targetVizType: string,
    exploreState: Record<string, any>,
  ): {
    formData: QueryFormData;
    controlsState: ControlStateMapping;
  } {
    /*
     * Transfrom form_data between different viz. Return new form_data and controlsState.
     * 1. get memorized form_data by viz type or get previous form_data
     * 2. collect public control values
     * 3. generate initial targetControlsState
     * 4. attach `standardizedFormData` to the initial form_data
     * 5. call denormalizeFormData to transform initial form_data if the plugin was defined
     * 6. use final form_data to generate controlsState
     * */
    const latestFormData = this.getLatestFormData(targetVizType);
    const publicFormData = {};
    publicControls.forEach(key => {
      if (key in exploreState.form_data) {
        publicFormData[key] = exploreState.form_data[key];
      }
    });
    const targetControlsState = getControlsState(exploreState, {
      ...latestFormData,
      ...publicFormData,
      viz_type: targetVizType,
    });
    const targetFormData = {
      ...getFormDataFromControls(targetControlsState),
      standardizedFormData: this.serialize(),
    };

    const controlPanel = getChartControlPanelRegistry().get(targetVizType);
    if (controlPanel?.denormalizeFormData) {
      const transformed = controlPanel.denormalizeFormData(targetFormData);
      return {
        formData: transformed,
        controlsState: getControlsState(exploreState, transformed),
      };
    }

    return {
      formData: targetFormData,
      controlsState: targetControlsState,
    };
  }
}
