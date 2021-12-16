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
import React from 'react';
import { t, validateNonEmpty, validateInteger } from '@superset-ui/core';
import {
  sharedControls,
  ControlPanelConfig,
  D3_FORMAT_OPTIONS,
  sections,
  emitFilterControl,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: t('Group by'),
              description: t('Columns to group by'),
            },
          },
        ],
        ['metric'],
        ['adhoc_filters'],
        emitFilterControl,
        [
          {
            name: 'row_limit',
            config: {
              ...sharedControls.row_limit,
              choices: [...Array(10).keys()].map(n => n + 1),
              default: DEFAULT_FORM_DATA.rowLimit,
            },
          },
        ],
        [
          {
            name: 'sort_by_metric',
            config: {
              type: 'CheckboxControl',
              label: t('Sort by metric'),
              description: t(
                'Whether to sort results by the selected metric in descending order.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [<h1 className="section-header">{t('General')}</h1>],
        [
          {
            name: 'min_val',
            config: {
              type: 'TextControl',
              isInt: true,
              default: String(DEFAULT_FORM_DATA.minVal),
              validators: [validateNonEmpty, validateInteger],
              renderTrigger: true,
              label: t('Min'),
              description: t('Minimum value on the gauge axis'),
            },
          },
          {
            name: 'max_val',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.maxVal,
              validators: [validateNonEmpty, validateInteger],
              renderTrigger: true,
              label: t('Max'),
              description: t('Maximum value on the gauge axis'),
            },
          },
        ],
        [
          {
            name: 'start_angle',
            config: {
              type: 'TextControl',
              label: t('Start angle'),
              description: t('Angle at which to start progress axis'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.startAngle,
            },
          },
          {
            name: 'end_angle',
            config: {
              type: 'TextControl',
              label: t('End angle'),
              description: t('Angle at which to end progress axis'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.endAngle,
            },
          },
        ],
        ['color_scheme'],
        [
          {
            name: 'font_size',
            config: {
              type: 'SliderControl',
              label: t('Font size'),
              description: t(
                'Font size for axis labels, detail value and other text elements',
              ),
              renderTrigger: true,
              min: 10,
              max: 20,
              default: DEFAULT_FORM_DATA.fontSize,
            },
          },
        ],
        [
          {
            name: 'number_format',
            config: {
              type: 'SelectControl',
              label: t('Number format'),
              description: t(
                'D3 format syntax: https://github.com/d3/d3-format',
              ),
              freeForm: true,
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.numberFormat,
              choices: D3_FORMAT_OPTIONS,
            },
          },
        ],
        [
          {
            name: 'value_formatter',
            config: {
              type: 'TextControl',
              label: t('Value format'),
              description: t(
                'Additional text to add before or after the value, e.g. unit',
              ),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.valueFormatter,
            },
          },
        ],
        [
          {
            name: 'show_pointer',
            config: {
              type: 'CheckboxControl',
              label: t('Show pointer'),
              description: t('Whether to show the pointer'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.showPointer,
            },
          },
        ],
        [
          {
            name: 'animation',
            config: {
              type: 'CheckboxControl',
              label: t('Animation'),
              description: t(
                'Whether to animate the progress and the value or just display them',
              ),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.animation,
            },
          },
        ],
        [<h1 className="section-header">{t('Axis')}</h1>],
        [
          {
            name: 'show_axis_tick',
            config: {
              type: 'CheckboxControl',
              label: t('Show axis line ticks'),
              description: t('Whether to show minor ticks on the axis'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.showAxisTick,
            },
          },
        ],
        [
          {
            name: 'show_split_line',
            config: {
              type: 'CheckboxControl',
              label: t('Show split lines'),
              description: t('Whether to show the split lines on the axis'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.showSplitLine,
            },
          },
        ],
        [
          {
            name: 'split_number',
            config: {
              type: 'SliderControl',
              label: t('Split number'),
              description: t('Number of split segments on the axis'),
              renderTrigger: true,
              min: 3,
              max: 30,
              default: DEFAULT_FORM_DATA.splitNumber,
            },
          },
        ],
        [<h1 className="section-header">{t('Progress')}</h1>],
        [
          {
            name: 'show_progress',
            config: {
              type: 'CheckboxControl',
              label: t('Show progress'),
              description: t('Whether to show the progress of gauge chart'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.showProgress,
            },
          },
        ],
        [
          {
            name: 'overlap',
            config: {
              type: 'CheckboxControl',
              label: t('Overlap'),
              description: t(
                'Whether the progress bar overlaps when there are multiple groups of data',
              ),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.overlap,
            },
          },
        ],
        [
          {
            name: 'round_cap',
            config: {
              type: 'CheckboxControl',
              label: t('Round cap'),
              description: t(
                'Style the ends of the progress bar with a round cap',
              ),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.roundCap,
            },
          },
        ],
        [<h1 className="section-header">{t('Intervals')}</h1>],
        [
          {
            name: 'intervals',
            config: {
              type: 'TextControl',
              label: t('Interval bounds'),
              description: t(
                'Comma-separated interval bounds, e.g. 2,4,5 for intervals 0-2, 2-4 and 4-5. Last number should match the value provided for MAX.',
              ),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.intervals,
            },
          },
        ],
        [
          {
            name: 'interval_color_indices',
            config: {
              type: 'TextControl',
              label: t('Interval colors'),
              description: t(
                'Comma-separated color picks for the intervals, e.g. 1,2,4. Integers denote colors from the chosen color scheme and are 1-indexed. Length must be matching that of interval bounds.',
              ),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.intervalColorIndices,
            },
          },
        ],
      ],
    },
  ],
};

export default config;
