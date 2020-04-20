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
import { TIME_FILTER_MAP } from '../../visualizations/FilterBox/FilterBox';
import { TIME_FILTER_LABELS } from '../../explore/constants';

/**
 * Parse filters for Table chart. All non-metric columns are considered
 * filterable values.
 */
function getFilterConfigsFromTableChart(form_data = {}) {
  const { groupby = [], all_columns = [] } = form_data;
  const configs = { columns: {}, labels: {} };
  // `groupby` is from GROUP BY mode (aggregations)
  // `all_columns` is from NOT GROUP BY mode (raw records)
  const columns = groupby.concat(all_columns);
  columns.forEach(column => {
    configs.columns[column] = undefined;
    configs.labels[column] = column;
  });
  return configs;
}

/**
 * Parse filter configs for FilterBox.
 */
function getFilterConfigsFromFilterBox(form_data = {}) {
  const {
    date_filter,
    filter_configs = [],
    show_druid_time_granularity,
    show_druid_time_origin,
    show_sqla_time_column,
    show_sqla_time_granularity,
    table_filter,
  } = form_data;
  const configs = { columns: {}, labels: {} };

  filter_configs.forEach(({ column, label, defaultValue, multiple, vals }) => {
    // treat empty string as undefined, too
    const defaultValues =
      multiple && defaultValue ? defaultValue.split(';') : defaultValue;
    configs.columns[column] = vals || defaultValues;
    configs.labels[column] = label;
  });

  if (date_filter) {
    configs.columns[TIME_FILTER_MAP.time_range] = form_data.time_range;
    // a map from frontend enum key to backend column
    Object.entries(TIME_FILTER_MAP).forEach(([key, column]) => {
      configs.labels[column] = TIME_FILTER_LABELS[key];
    });
    if (show_sqla_time_granularity) {
      configs.columns[TIME_FILTER_MAP.time_grain_sqla] =
        form_data.time_grain_sqla;
    }
    if (show_sqla_time_column) {
      configs.columns[TIME_FILTER_MAP.granularity_sqla] =
        form_data.granularity_sqla;
    }
    if (show_druid_time_granularity) {
      configs.columns[TIME_FILTER_MAP.granularity] = form_data.granularity;
    }
    if (show_druid_time_origin) {
      configs.columns[TIME_FILTER_MAP.druid_time_origin] =
        form_data.druid_time_origin;
    }
  }
  return configs;
}

export default function getFilterConfigsFromFormdata(
  form_data = {},
  filters = undefined,
) {
  const configs = form_data.table_filter
    ? getFilterConfigsFromTableChart(form_data)
    : getFilterConfigsFromFilterBox(form_data);

  // if current chart has preselected filters, update it
  if (filters) {
    Object.keys(filters).forEach(column => {
      if (column in configs.columns && filters[column]) {
        configs.columns[column] = filters[column];
      }
    });
  }
  return configs;
}
