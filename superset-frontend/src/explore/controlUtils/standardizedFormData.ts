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

export const sharedControls: Record<keyof StandardizedState, string[]> = {
  metrics: ['metric', 'metrics', 'metric_2'],
  columns: ['groupby', 'columns', 'groupbyColumns', 'groupbyRows'],
};
export const publicControls = [
  // time section
  'granularity_sqla',
  'time_grain_sqla',
  'time_range',
  // filters
  'adhoc_filters',
  // subquery limit(series limit)
  'limit',
  // order by clause
  'timeseries_limit_metric',
  'series_limit_metric',
  // desc or asc in order by clause
  'order_desc',
  // outer query limit
  'row_limit',
  // x asxs column
  'x_axis',
  // advanced analytics - rolling window
  'rolling_type',
  'rolling_periods',
  'min_periods',
  // advanced analytics - time comparison
  'time_compare',
  'comparison_type',
  // advanced analytics - resample
  'resample_rule',
  'resample_method',
];

export class StandardizedFormData {
  private sfd: StandardizedFormDataInterface;

  constructor(sourceFormData: QueryFormData) {
    /*
     * Support form_data for smooth switching between different viz
     * */
    const standardizedState = {
      metrics: [],
      columns: [],
    };
    const formData = Object.freeze(sourceFormData);
    const reversedMap = StandardizedFormData.getReversedMap();

    Object.entries(formData).forEach(([key, value]) => {
      if (reversedMap.has(key)) {
        standardizedState[reversedMap.get(key)].push(...ensureIsArray(value));
      }
    });

    const memorizedFormData = Array.isArray(
      formData?.standardizedFormData?.memorizedFormData,
    )
      ? new Map(formData.standardizedFormData.memorizedFormData)
      : new Map();
    const vizType = formData.viz_type;
    if (memorizedFormData.has(vizType)) {
      memorizedFormData.delete(vizType);
    }
    memorizedFormData.set(vizType, formData);
    this.sfd = {
      standardizedState,
      memorizedFormData,
    };
  }

  static getReversedMap() {
    const reversedMap = new Map();
    Object.entries(sharedControls).forEach(([key, names]) => {
      names.forEach(name => {
        reversedMap.set(name, key);
      });
    });
    return reversedMap;
  }

  private getLatestFormData(vizType: string): QueryFormData {
    if (this.sfd.memorizedFormData.has(vizType)) {
      return this.sfd.memorizedFormData.get(vizType) as QueryFormData;
    }

    return this.memorizedFormData.slice(-1)[0][1];
  }

  private get standardizedState() {
    return this.sfd.standardizedState;
  }

  private get memorizedFormData() {
    return Array.from(this.sfd.memorizedFormData.entries());
  }

  dumpSFD() {
    return {
      standardizedState: this.standardizedState,
      memorizedFormData: this.memorizedFormData,
    };
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
      standardizedFormData: this.dumpSFD(),
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
