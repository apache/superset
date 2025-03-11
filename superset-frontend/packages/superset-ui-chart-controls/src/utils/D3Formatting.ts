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
  t,
  SMART_DATE_ID,
  NumberFormats,
  getNumberFormatter,
} from '@superset-ui/core';

// D3 specific formatting config
export const D3_FORMAT_DOCS = t(
  'D3 format syntax: https://github.com/d3/d3-format',
);

export const D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT = t(
  'Only applies when "Label Type" is set to show values.',
);
export const D3_NUMBER_FORMAT_DESCRIPTION_PERCENTAGE_TEXT = t(
  'Only applies when "Label Type" is not set to a percentage.',
);

const d3Formatted: [string, string][] = [
  ',d',
  '.1s',
  '.3s',
  ',.1%',
  '.2%',
  '.3%',
  '.4r',
  ',.1f',
  ',.2f',
  ',.3f',
  '+,',
  '$,.2f',
].map(fmt => [fmt, `${fmt} (${getNumberFormatter(fmt).preview()})`]);

// input choices & options
export const D3_FORMAT_OPTIONS: [string, string][] = [
  [NumberFormats.SMART_NUMBER, t('Adaptive formatting')],
  ['~g', t('Original value')],
  ...d3Formatted,
  ['DURATION', t('Duration in ms (66000 => 1m 6s)')],
  ['DURATION_SUB', t('Duration in ms (1.40008 => 1ms 400µs 80ns)')],
  ['DURATION_COL', t('Duration in ms (10500 => 0:10.5)')],
  ['MEMORY_DECIMAL', t('Memory in bytes - decimal (1024B => 1.024kB)')],
  ['MEMORY_BINARY', t('Memory in bytes - binary (1024B => 1KiB)')],
  [
    'MEMORY_TRANSFER_RATE_DECIMAL',
    t('Memory transfer rate in bytes - decimal (1024B => 1.024kB/s)'),
  ],
  [
    'MEMORY_TRANSFER_RATE_BINARY',
    t('Memory transfer rate in bytes - binary (1024B => 1KiB/s)'),
  ],
];

export const D3_TIME_FORMAT_DOCS = t(
  'D3 time format syntax: https://github.com/d3/d3-time-format',
);

export const D3_TIME_FORMAT_OPTIONS: [string, string][] = [
  [SMART_DATE_ID, t('Adaptive formatting')],
  ['%d/%m/%Y', '%d/%m/%Y | 14/01/2019'],
  ['%m/%d/%Y', '%m/%d/%Y | 01/14/2019'],
  ['%Y-%m-%d', '%Y-%m-%d | 2019-01-14'],
  ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S | 2019-01-14 01:32:10'],
  ['%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M:%S | 14-01-2019 01:32:10'],
  ['%H:%M:%S', '%H:%M:%S | 01:32:10'],
];

export const DEFAULT_NUMBER_FORMAT = D3_FORMAT_OPTIONS[0][0];
export const DEFAULT_TIME_FORMAT = D3_TIME_FORMAT_OPTIONS[0][0];
