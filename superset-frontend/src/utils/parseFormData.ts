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
import { BaseFormData, RequiredKeys } from '@superset-ui/core/src/types';
import {
  TimeseriesDefaultFormData,
  TimeseriesRequiredProperties,
  MixedTimeseriesDefaultFormData,
  MixedTimeseriesRequiredProperties,
} from '@superset-ui/plugin-chart-echarts';
import { logging } from '@superset-ui/core';

const PLUGIN_METADATA: {
  [key: string]: [
    Partial<BaseFormData>,
    Record<keyof RequiredKeys<BaseFormData>, true>,
  ];
} = {
  echarts_timeseries_line: [
    TimeseriesDefaultFormData,
    TimeseriesRequiredProperties,
  ],
  mixed_timeseries: [
    MixedTimeseriesDefaultFormData,
    MixedTimeseriesRequiredProperties,
  ],
};

/**
 * Parses a formData object, and returns a new object with:
 * - required properties without values set to their default values
 * - optional properties not in formData set to their default values
 * @param formData the formData object to parse
 * @returns a new formData object
 */
export default function parseFormData(formData: BaseFormData) {
  if (!(formData.viz_type in PLUGIN_METADATA)) {
    logging.warn(
      "Required form data properties won't be automatically filled because viz_type '%s' was not found in PLUGIN_METADATA",
      formData.viz_type,
    );
    return formData;
  }

  const parsedFormData = { ...formData };
  const [defaultFormData, requiredProperties] =
    PLUGIN_METADATA[formData.viz_type];

  Object.keys(defaultFormData).forEach((key: keyof BaseFormData) => {
    const required = key in requiredProperties;
    const inFormData = key in formData;
    if (required) {
      const value = formData[key];
      if (!value) {
        parsedFormData[key] = defaultFormData[key];
      }
    } else if (!inFormData) {
      parsedFormData[key] = defaultFormData[key];
    }
  });
  return parsedFormData;
}
