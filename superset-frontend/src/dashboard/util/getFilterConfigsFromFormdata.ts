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
/* eslint-disable camelcase */
import {
  FILTER_CONFIG_ATTRIBUTES,
  TIME_FILTER_LABELS,
  TIME_FILTER_MAP,
} from 'src/explore/constants';

export default function getFilterConfigsFromFormdata(form_data = {}) {
  const {
    // @ts-expect-error TS(2339): Property 'date_filter' does not exist on type '{}'... Remove this comment to see the full error message
    date_filter,
    // @ts-expect-error TS(2339): Property 'filter_configs' does not exist on type '... Remove this comment to see the full error message
    filter_configs = [],
    // @ts-expect-error TS(2339): Property 'show_sqla_time_column' does not exist on... Remove this comment to see the full error message
    show_sqla_time_column,
    // @ts-expect-error TS(2339): Property 'show_sqla_time_granularity' does not exi... Remove this comment to see the full error message
    show_sqla_time_granularity,
  } = form_data;
  let configs = filter_configs.reduce(
    ({ columns, labels }: $TSFixMe, config: $TSFixMe) => {
      let defaultValues = config[FILTER_CONFIG_ATTRIBUTES.DEFAULT_VALUE];

      // treat empty string as null (no default value)
      if (defaultValues === '') {
        defaultValues = null;
      }

      // defaultValue could be ; separated values,
      // could be null or ''
      if (defaultValues && config[FILTER_CONFIG_ATTRIBUTES.MULTIPLE]) {
        defaultValues = config.defaultValue.split(';');
      }

      const updatedColumns = {
        ...columns,
        [config.column]: config.vals || defaultValues,
      };
      const updatedLabels = {
        ...labels,
        [config.column]: config.label,
      };

      return {
        columns: updatedColumns,
        labels: updatedLabels,
      };
    },
    { columns: {}, labels: {} },
  );

  if (date_filter) {
    let updatedColumns = {
      ...configs.columns,
      // @ts-expect-error TS(2339): Property 'time_range' does not exist on type '{}'.
      [TIME_FILTER_MAP.time_range]: form_data.time_range,
    };
    const updatedLabels = {
      ...configs.labels,
      ...Object.entries(TIME_FILTER_MAP).reduce(
        (map, [key, value]) => ({
          ...map,
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          [value]: TIME_FILTER_LABELS[key],
        }),
        {},
      ),
    };

    if (show_sqla_time_granularity) {
      updatedColumns = {
        ...updatedColumns,
        // @ts-expect-error TS(2339): Property 'time_grain_sqla' does not exist on type ... Remove this comment to see the full error message
        [TIME_FILTER_MAP.time_grain_sqla]: form_data.time_grain_sqla,
      };
    }

    if (show_sqla_time_column) {
      updatedColumns = {
        ...updatedColumns,
        // @ts-expect-error TS(2339): Property 'granularity_sqla' does not exist on type... Remove this comment to see the full error message
        [TIME_FILTER_MAP.granularity_sqla]: form_data.granularity_sqla,
      };
    }

    configs = {
      ...configs,
      columns: updatedColumns,
      labels: updatedLabels,
    };
  }
  return configs;
}
