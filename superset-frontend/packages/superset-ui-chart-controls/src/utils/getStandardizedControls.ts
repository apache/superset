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
import { makeSingleton, QueryFormData } from '@superset-ui/core';
import { isStandardizedFormData, StandardizedControls } from '../types';

class StandardizedControlsManager {
  controls: StandardizedControls;

  constructor() {
    this.controls = {
      metrics: [],
      columns: [],
    };
  }

  setStandardizedControls(formData: QueryFormData) {
    if (isStandardizedFormData(formData)) {
      const { controls } = formData.standardizedFormData;
      this.controls = {
        metrics: controls.metrics,
        columns: controls.columns,
      };
    }
  }

  shiftMetric() {
    return this.controls.metrics.shift();
  }

  shiftColumn() {
    return this.controls.columns.shift();
  }

  popAllMetrics() {
    return this.controls.metrics.splice(0, this.controls.metrics.length);
  }

  popAllColumns() {
    return this.controls.columns.splice(0, this.controls.columns.length);
  }

  clear() {
    this.controls = {
      metrics: [],
      columns: [],
    };
  }
}

export const getStandardizedControls = makeSingleton(
  StandardizedControlsManager,
);
