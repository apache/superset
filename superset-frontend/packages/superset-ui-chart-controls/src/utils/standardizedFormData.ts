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
  AdhocColumn,
  AdhocFilter,
  AdhocMetric,
  ensureIsArray,
  JsonObject,
  PhysicalColumn,
  QueryFormData,
} from '@superset-ui/core';

function isStandardizedFormData(formData: JsonObject): boolean {
  return 'sharedFormData' in formData && 'memorizedFormData' in formData;
}

interface iStandardizedFormData {
  sharedFormData: {
    metrics: AdhocMetric[];
    columns: (AdhocColumn | PhysicalColumn)[];
    filters: AdhocFilter[];
  };
  memorizedFormData: Map<string, QueryFormData>;
}

export class StandardizedFormData {
  private sfd: iStandardizedFormData;

  constructor(sourceFormData: QueryFormData) {
    const sharedFormData = {
      metrics: [],
      columns: [],
      filters: [],
    };
    // shallow copy
    const formData = { ...sourceFormData };
    const reversedMap = StandardizedFormData.getReversedMap();

    Object.entries(formData).forEach(([key, value]) => {
      if (reversedMap.has(key)) {
        sharedFormData[reversedMap.get(key)].push(...ensureIsArray(value));
      }
    });

    const memorizedFormData =
      isStandardizedFormData(formData) &&
      Array.isArray(formData.memorizedFormData)
        ? new Map(formData.memorizedFormData)
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
      filters: ['adhoc_filters'],
    };
    const reversedMap = new Map();
    Object.entries(sharedControls).forEach(([key, names]) => {
      names.forEach(name => {
        reversedMap.set(name, key);
      });
    });
    return reversedMap;
  }

  getLatestFormData(vizType: string) {
    if (this.sfd.memorizedFormData.has(vizType)) {
      return this.sfd.memorizedFormData.get(vizType);
    }

    return this.memorizedFormData.slice(-1)[0][1];
  }

  get sharedFormData() {
    return this.sfd.sharedFormData;
  }

  get memorizedFormData() {
    return Array.from(this.sfd.memorizedFormData.entries());
  }
}
