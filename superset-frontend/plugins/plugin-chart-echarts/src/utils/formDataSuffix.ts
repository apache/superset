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
import { QueryFormData } from '@superset-ui/core';

export const retainFormDataSuffix = (
  formData: QueryFormData,
  controlSuffix: string,
): QueryFormData => {
  /*
   * retain controls by suffix and return a new formData
   * eg:
   * > const fd = { metrics: ['foo', 'bar'], metrics_b: ['zee'], limit: 100, ... }
   * > removeFormDataSuffix(fd, '_b')
   * { metrics: ['zee'], limit: 100, ... }
   * */
  const newFormData = {};

  Object.entries(formData)
    .sort(([a], [b]) => {
      // items contained suffix before others
      const weight_a = a.endsWith(controlSuffix) ? 1 : 0;
      const weight_b = b.endsWith(controlSuffix) ? 1 : 0;
      return weight_b - weight_a;
    })
    .forEach(([key, value]) => {
      if (key.endsWith(controlSuffix)) {
        newFormData[key.slice(0, -controlSuffix.length)] = value;
      }

      if (!key.endsWith(controlSuffix) && !(key in newFormData)) {
        // ignore duplication
        newFormData[key] = value;
      }
    });

  return newFormData as QueryFormData;
};

export const removeFormDataSuffix = (
  formData: QueryFormData,
  controlSuffix: string,
): QueryFormData => {
  /*
   * remove unused controls by suffix and return a new formData
   * eg:
   * > const fd = { metrics: ['foo', 'bar'], metrics_b: ['zee'], limit: 100, ... }
   * > removeUnusedFormData(fd, '_b')
   * { metrics: ['foo', 'bar'], limit: 100, ... }
   * */
  const newFormData = {};
  Object.entries(formData).forEach(([key, value]) => {
    if (!key.endsWith(controlSuffix)) {
      newFormData[key] = value;
    }
  });

  return newFormData as QueryFormData;
};
