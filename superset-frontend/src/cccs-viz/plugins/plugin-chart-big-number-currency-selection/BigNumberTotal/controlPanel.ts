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
import { t, NumberFormats } from '@superset-ui/core';
import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';
import { headerFontSize, subheaderFontSize } from '../sharedControls';

export const D3_FORMAT_OPTIONS: [string, string][] = [
  [NumberFormats.SMART_NUMBER, t('Adaptative formatting')],
  ['~g', t('Original value')],
  [',d', ',d (12345.432 => 12,345)'],
  ['.1s', '.1s (12345.432 => 10k)'],
  ['.3s', '.3s (12345.432 => 12.3k)'],
  [',.1%', ',.1% (12345.432 => 1,234,543.2%)'],
  ['.3%', '.3% (12345.432 => 1234543.200%)'],
  ['.4r', '.4r (12345.432 => 12350)'],
  [',.3f', ',.3f (12345.432 => 12,345.432)'],
  ['+,', '+, (12345.432 => +12,345.432)'],
  ['$,.0f', '$,.0f (12345.432 => $12,345)'],
  ['$,.1f', '$,.1f (12345.432 => $12,345.4)'],
  ['$,.2f', '$,.2f (12345.432 => $12,345.43)'],
  ['฿,.0f', '฿,.0f (12345.432 => ฿12,345)'],
  ['฿,.1f', '฿,.1f (12345.432 => ฿12,345.4)'],
  ['฿,.2f', '฿,.2f (12345.432 => ฿12,345.43)'],
  ['€,.0f', '€,.0f (12345.432 => €12,345)'],
  ['€,.1f', '€,.1f (12345.432 => €12,345.4)'],
  ['€,.2f', '€,.2f (12345.432 => €12,345.43)'],
  ['£,.0f', '£,.0f (12345.432 => £12,345)'],
  ['£,.1f', '£,.1f (12345.432 => £12,345.4)'],
  ['£,.2f', '£,.2f (12345.432 => £12,345.43)'],
  ['DURATION', t('Duration in ms (66000 => 1m 6s)')],
  ['DURATION_SUB', t('Duration in ms (1.40008 => 1ms 400µs 80ns)')],
];

export default {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['metric'], ['adhoc_filters']],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'subheader',
            config: {
              type: 'TextControl',
              label: t('Subheader'),
              description: t(
                'Description text that shows up below your Big Number',
              ),
            },
          },
        ],
        ['y_axis_format'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [[headerFontSize], [subheaderFontSize]],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
      choices: D3_FORMAT_OPTIONS,
    },
  },
} as ControlPanelConfig;
