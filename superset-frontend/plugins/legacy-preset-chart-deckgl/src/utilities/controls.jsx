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
export function columnChoices(datasource) {
  if (datasource && datasource.columns) {
    return datasource.columns
      .map(col => [col.column_name, col.verbose_name || col.column_name])
      .sort((opt1, opt2) =>
        opt1[1].toLowerCase() > opt2[1].toLowerCase() ? 1 : -1,
      );
  }
  return [];
}

// input choices & options
export const D3_FORMAT_OPTIONS = [
  ['SMART_NUMBER', 'Adaptative formating'],
  ['~g', 'Original value'],
  [',d', ',d (12345.432 => 12,345)'],
  ['.1s', '.1s (12345.432 => 10k)'],
  ['.3s', '.3s (12345.432 => 12.3k)'],
  [',.1%', ',.1% (12345.432 => 1,234,543.2%)'],
  ['.3%', '.3% (12345.432 => 1234543.200%)'],
  ['.4r', '.4r (12345.432 => 12350)'],
  [',.3f', ',.3f (12345.432 => 12,345.432)'],
  ['+,', '+, (12345.432 => +12,345.432)'],
  ['$,.2f', '$,.2f (12345.432 => $12,345.43)'],
  ['DURATION', 'Duration in ms (66000 => 1m 6s)'],
  ['DURATION_SUB', 'Duration in ms (100.40008 => 100ms 400µs 80ns)'],
];

export const PRIMARY_COLOR = { r: 0, g: 122, b: 135, a: 1 };

export default {
  default: null,
  mapStateToProps: state => ({
    choices: state.datasource
      ? state.datasource.time_grain_sqla.filter(o => o[0] !== null)
      : null,
  }),
};
