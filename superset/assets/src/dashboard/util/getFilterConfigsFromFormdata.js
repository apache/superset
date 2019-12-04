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
  TIME_FILTER_MAP,
  TIME_RANGE,
  FILTER_LABELS,
} from '../../visualizations/FilterBox/FilterBox';

export default function getFilterConfigsFromFormdata(form_data = {}) {
  const {
    date_filter,
    filter_configs = [],
    show_druid_time_granularity,
    show_druid_time_origin,
    show_sqla_time_column,
    show_sqla_time_granularity,
  } = form_data;
  let configs = filter_configs.reduce(
    ({ columns, labels }, config) => {
      const updatedColumns = {
        ...columns,
        [config.column]: config.vals,
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
      [TIME_FILTER_MAP.time_range]: form_data.time_range,
    };
    const updatedLabels = {
      ...configs.labels,
      [TIME_FILTER_MAP.time_range]: FILTER_LABELS[TIME_RANGE],
    };

    if (show_sqla_time_granularity) {
      updatedColumns = {
        ...updatedColumns,
        [TIME_FILTER_MAP.time_grain_sqla]: form_data.time_grain_sqla,
      };
    }

    if (show_sqla_time_column) {
      updatedColumns = {
        ...updatedColumns,
        [TIME_FILTER_MAP.granularity_sqla]: form_data.granularity_sqla,
      };
    }

    if (show_druid_time_granularity) {
      updatedColumns = {
        ...updatedColumns,
        [TIME_FILTER_MAP.granularity]: form_data.granularity,
      };
    }

    if (show_druid_time_origin) {
      updatedColumns = {
        ...updatedColumns,
        [TIME_FILTER_MAP.druid_time_origin]: form_data.druid_time_origin,
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
