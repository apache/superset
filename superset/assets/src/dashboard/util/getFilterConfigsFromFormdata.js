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
  TIME_RANGE,
  FILTER_LABELS,
} from '../../visualizations/FilterBox/FilterBox';

export default function getFilterConfigsFromFormdata(form_data = {}) {
  const { date_filter, filter_configs = [] } = form_data;
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
    const updatedColumns = {
      ...configs.columns,
      [TIME_RANGE]: form_data[TIME_RANGE],
    };
    const updatedLabels = {
      ...configs.labels,
      [TIME_RANGE]: FILTER_LABELS[TIME_RANGE],
    };

    configs = {
      ...configs,
      columns: updatedColumns,
      labels: updatedLabels,
    };
  }
  return configs;
}
