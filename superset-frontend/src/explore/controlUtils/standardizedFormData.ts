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
import { omit } from 'lodash';
import {
  ensureIsArray,
  getChartControlPanelRegistry,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import {
  ControlStateMapping,
  getStandardizedControls,
  isStandardizedFormData,
  StandardizedControls,
  StandardizedFormDataInterface,
} from '@superset-ui/chart-controls';
import { getControlsState } from 'src/explore/store';
import { getFormDataFromControls } from './getFormDataFromControls';

export const sharedMetricsKey = [
  'metric', // via sharedControls, scalar
  'metrics', // via sharedControls, array
  'metric_2', // via sharedControls, scalar
  'size', // via sharedControls, scalar
  'x', // via sharedControls, scalar
  'y', // via sharedControls, scalar
  'secondary_metric', // via sharedControls, scalar
];
export const sharedColumnsKey = [
  'groupby', // via sharedControls, array
  'columns', // via sharedControls, array
  'groupbyColumns', // via pivot table v2, array
  'groupbyRows', // via pivot table v2, array
  'entity', // via sharedControls, scalar
  'series', // via sharedControls, scalar
  'series_columns', // via sharedControls, array
];

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

    // generates an ordered map, the key is viz_type and the value is form_data. the last item is current viz.
    const mfd = formData?.standardizedFormData?.memorizedFormData;
    const vizType = formData.viz_type;
    let memorizedFormData = new Map<string, QueryFormData>();
    let controls: StandardizedControls;
    if (
      Array.isArray(mfd) &&
      mfd.length > 0 &&
      formData.datasource === mfd.slice(-1)[0][1]?.datasource
    ) {
      memorizedFormData = new Map(
        formData.standardizedFormData.memorizedFormData,
      );
      if (memorizedFormData.has(vizType)) {
        memorizedFormData.delete(vizType);
      }
      memorizedFormData.set(vizType, formData);
      controls = StandardizedFormData.getStandardizedControls(formData);
    } else {
      // reset the `memorizedFormData` if a request between different datasource.
      const restFormData = omit(
        formData,
        'standardizedFormData',
      ) as QueryFormData;
      memorizedFormData.set(vizType, restFormData);
      controls = StandardizedFormData.getStandardizedControls(restFormData);
    }

    this.sfd = {
      controls,
      memorizedFormData,
    };
  }

  static getStandardizedControls(
    formData: QueryFormData,
  ): StandardizedControls {
    // 1. initial StandardizedControls
    const controls: StandardizedControls = {
      metrics: [],
      columns: [],
    };

    // 2. collect current sharedControls
    Object.entries(formData).forEach(([key, value]) => {
      if (sharedMetricsKey.includes(key)) {
        controls.metrics.push(...ensureIsArray<QueryFormMetric>(value));
      }
      if (sharedColumnsKey.includes(key)) {
        controls.columns.push(...ensureIsArray<QueryFormColumn>(value));
      }
    });

    // 3. append inherit sharedControls
    if (isStandardizedFormData(formData)) {
      const { metrics, columns } = formData.standardizedFormData.controls;
      controls.metrics.push(...metrics);
      controls.columns.push(...columns);
    }

    return controls;
  }

  private getLatestFormData(vizType: string): QueryFormData {
    if (this.has(vizType)) {
      return this.get(vizType);
    }
    return this.memorizedFormData.slice(-1)[0][1];
  }

  private get standardizedControls() {
    return this.sfd.controls;
  }

  private get memorizedFormData() {
    return Array.from(this.sfd.memorizedFormData.entries());
  }

  serialize() {
    return {
      controls: this.standardizedControls,
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
     * Transform form_data between different viz. Return new form_data and controlsState.
     * 1. get memorized form_data by viz type or get previous form_data
     * 2. collect public control values
     * 3. generate initial targetControlsState
     * 4. attach `standardizedFormData` to the initial form_data
     * 5. call formDataOverrides to transform initial form_data if the plugin was defined
     * 6. use final form_data to generate controlsState
     * 7. to refresh validator message
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

    let rv = {
      formData: targetFormData,
      controlsState: targetControlsState,
    };

    const controlPanel = getChartControlPanelRegistry().get(targetVizType);
    if (controlPanel?.formDataOverrides) {
      getStandardizedControls().setStandardizedControls(targetFormData);
      const transformed = {
        ...controlPanel.formDataOverrides(targetFormData),
        standardizedFormData: {
          controls: { ...getStandardizedControls().controls },
          memorizedFormData: this.memorizedFormData,
        },
      };
      getStandardizedControls().clear();
      rv = {
        formData: transformed,
        controlsState: getControlsState(exploreState, transformed),
      };
    }

    // refresh validator message
    rv.controlsState = getControlsState(
      { ...exploreState, controls: rv.controlsState },
      rv.formData,
    );
    return rv;
  }
}
