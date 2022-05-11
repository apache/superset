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
import { iStandardizedFormData } from '@superset-ui/chart-controls';
import { getControlsState } from 'src/explore/store';
import { getFormDataFromControls } from './getFormDataFromControls';

export class StandardizedFormData {
  private sfd: iStandardizedFormData;

  constructor(sourceFormData: QueryFormData) {
    const sharedFormData = {
      metrics: [],
      columns: [],
    };
    const formData = { ...sourceFormData };
    const reversedMap = StandardizedFormData.getReversedMap();

    Object.entries(formData).forEach(([key, value]) => {
      if (reversedMap.has(key)) {
        sharedFormData[reversedMap.get(key)].push(...ensureIsArray(value));
      }
    });

    const memorizedFormData = Array.isArray(
      formData?.standardized_form_data?.memorizedFormData,
    )
      ? new Map(formData.standardized_form_data.memorizedFormData)
      : new Map();
    const vizType = formData.viz_type;
    if (memorizedFormData.has(vizType)) {
      memorizedFormData.delete(vizType);
    }
    memorizedFormData.set(vizType, formData);
    this.sfd = {
      sharedFormData,
      memorizedFormData,
    };
  }

  static getReversedMap() {
    const sharedControls = {
      metrics: ['metric', 'metrics', 'metric_2'],
      columns: ['groupby', 'columns'],
    };
    const reversedMap = new Map();
    Object.entries(sharedControls).forEach(([key, names]) => {
      names.forEach(name => {
        reversedMap.set(name, key);
      });
    });
    return reversedMap;
  }

  getLatestFormData(vizType: string): QueryFormData {
    if (this.sfd.memorizedFormData.has(vizType)) {
      return this.sfd.memorizedFormData.get(vizType) as QueryFormData;
    }

    return this.memorizedFormData.slice(-1)[0][1];
  }

  get sharedFormData() {
    return this.sfd.sharedFormData;
  }

  get memorizedFormData() {
    return Array.from(this.sfd.memorizedFormData.entries());
  }

  dumpSFD() {
    return {
      sharedFormData: this.sharedFormData,
      memorizedFormData: this.memorizedFormData,
    };
  }

  transform(
    sourceVizType: string,
    targetVizType: string,
    exploreState: Record<string, any>,
  ): {
    formData: QueryFormData;
    controlsState: any;
  } {
    const sourceFormData = this.getLatestFormData(sourceVizType);
    const targetControlsState = getControlsState(exploreState, {
      ...sourceFormData,
      viz_type: targetVizType,
    });
    const targetFormData = {
      ...getFormDataFromControls(targetControlsState),
      standardized_form_data: this.dumpSFD(),
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
