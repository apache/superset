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
import { t } from '@apache-superset/core/translation';
import { NumberFormats } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlSubSectionHeader,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';
import { subtitleFontSize } from '../sharedControls';
import {
  COMPARISON_OFFSET_CHOICES,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BIG_NUMBER_COLOR,
  DEFAULT_BIG_NUMBER_FONT_SIZE,
  DEFAULT_BIG_NUMBER_LEFT,
  DEFAULT_BIG_NUMBER_TOP,
  DEFAULT_COMPARISON1_LABEL,
  DEFAULT_COMPARISON1_LEFT,
  DEFAULT_COMPARISON1_OFFSET,
  DEFAULT_COMPARISON2_LABEL,
  DEFAULT_COMPARISON2_LEFT,
  DEFAULT_COMPARISON2_OFFSET,
  DEFAULT_COMPARISON_FONT_SIZE,
  DEFAULT_COMPARISON_NEGATIVE_COLOR,
  DEFAULT_COMPARISON_POSITIVE_COLOR,
  DEFAULT_COMPARISON_TOP,
  DEFAULT_COMPARISON_ZERO_COLOR,
  DEFAULT_TITLE_COLOR,
  DEFAULT_TITLE_LEFT,
  DEFAULT_TITLE_TOP,
} from './constants';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'granularity_sqla',
            config: sharedControls.granularity_sqla,
          },
        ],
        [
          {
            name: 'time_grain_sqla',
            config: sharedControls.time_grain_sqla,
          },
        ],
        ['metric'],
        [
          {
            name: 'comparison1_mode',
            config: {
              type: 'SelectControl',
              label: t('MoM comparison source'),
              default: 'time_shift',
              choices: [
                ['time_shift', t('Time comparison (shift)')],
                ['metric', t('Comparison value metric')],
              ],
              visibility: ({ controls }) =>
                controls?.show_comparison1?.value === true,
            },
          },
        ],
        [
          {
            name: 'comparison1_column',
            config: {
              ...sharedControls.metric,
              label: t('MoM comparison value'),
              clearable: true,
              // The comparison value is optional: do not inherit the
              // required validator from the metric control. Hidden
              // controls are still validated by Explore, so a required
              // validator here blocks chart creation in time-shift mode.
              validators: [],
              description: t(
                'Metric (or custom SQL expression) holding the MoM comparison value. This mode does not require a time range.',
              ),
              visibility: ({ controls }) =>
                controls?.show_comparison1?.value === true &&
                controls?.comparison1_mode?.value === 'metric',
            },
          },
        ],
        [
          {
            name: 'comparison1_offset',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('MoM time shift'),
              renderTrigger: true,
              default: DEFAULT_COMPARISON1_OFFSET,
              choices: COMPARISON_OFFSET_CHOICES,
              description: t(
                'Relative time period to compare against, e.g. "1 month ago".',
              ),
              visibility: ({ controls }) =>
                controls?.show_comparison1?.value === true &&
                controls?.comparison1_mode?.value !== 'metric',
            },
          },
        ],
        [
          {
            name: 'comparison2_mode',
            config: {
              type: 'SelectControl',
              label: t('YoY comparison source'),
              default: 'time_shift',
              choices: [
                ['time_shift', t('Time comparison (shift)')],
                ['metric', t('Comparison value metric')],
              ],
              visibility: ({ controls }) =>
                controls?.show_comparison2?.value === true,
            },
          },
        ],
        [
          {
            name: 'comparison2_column',
            config: {
              ...sharedControls.metric,
              label: t('YoY comparison value'),
              clearable: true,
              // See the MoM comparison value: the metric is optional.
              validators: [],
              description: t(
                'Metric (or custom SQL expression) holding the YoY comparison value. This mode does not require a time range.',
              ),
              visibility: ({ controls }) =>
                controls?.show_comparison2?.value === true &&
                controls?.comparison2_mode?.value === 'metric',
            },
          },
        ],
        [
          {
            name: 'comparison2_offset',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('YoY time shift'),
              renderTrigger: true,
              default: DEFAULT_COMPARISON2_OFFSET,
              choices: COMPARISON_OFFSET_CHOICES,
              description: t(
                'Relative time period to compare against, e.g. "1 year ago".',
              ),
              visibility: ({ controls }) =>
                controls?.show_comparison2?.value === true &&
                controls?.comparison2_mode?.value !== 'metric',
            },
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: sharedControls.row_limit,
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['y_axis_format'],
        ['currency_format'],
        [<ControlSubSectionHeader>{t('Title')}</ControlSubSectionHeader>],
        [
          {
            name: 'header_text',
            config: {
              type: 'TextControl',
              label: t('Title text'),
              renderTrigger: true,
              description: t(
                'Text displayed above the big number. Leave empty to hide it.',
              ),
            },
          },
        ],
        [
          {
            name: 'title_font_size',
            config: {
              ...subtitleFontSize.config,
              label: t('Title font size'),
            },
          },
        ],
        [
          {
            name: 'title_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Title color'),
              renderTrigger: true,
              default: DEFAULT_TITLE_COLOR,
            },
          },
        ],
        [
          {
            name: 'title_left',
            config: {
              type: 'TextControl',
              label: t('Title left position'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_TITLE_LEFT,
              description: t('Horizontal offset in pixels from the left edge.'),
            },
          },
        ],
        [
          {
            name: 'title_top',
            config: {
              type: 'TextControl',
              label: t('Title top position'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_TITLE_TOP,
              description: t('Vertical offset in pixels from the top edge.'),
            },
          },
        ],
        [
          <ControlSubSectionHeader>
            {t('Big Number')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'big_number_font_size',
            config: {
              type: 'TextControl',
              label: t('Big number font size'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_BIG_NUMBER_FONT_SIZE,
            },
          },
        ],
        [
          {
            name: 'big_number_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Big number color'),
              renderTrigger: true,
              default: DEFAULT_BIG_NUMBER_COLOR,
            },
          },
        ],
        [
          {
            name: 'big_number_left',
            config: {
              type: 'TextControl',
              label: t('Big number left position'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_BIG_NUMBER_LEFT,
              description: t('Horizontal offset in pixels from the left edge.'),
            },
          },
        ],
        [
          {
            name: 'big_number_top',
            config: {
              type: 'TextControl',
              label: t('Big number top position'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_BIG_NUMBER_TOP,
              description: t('Vertical offset in pixels from the top edge.'),
            },
          },
        ],
        [
          <ControlSubSectionHeader>
            {t('MoM Comparison')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'show_comparison1',
            config: {
              type: 'CheckboxControl',
              label: t('Show MoM comparison'),
              renderTrigger: true,
              default: true,
            },
          },
        ],
        [
          {
            name: 'comparison1_label',
            config: {
              type: 'TextControl',
              label: t('MoM label'),
              renderTrigger: true,
              default: t(DEFAULT_COMPARISON1_LABEL),
              visibility: ({ controls }) =>
                controls?.show_comparison1?.value === true,
            },
          },
        ],
        [
          {
            name: 'comparison1_left',
            config: {
              type: 'TextControl',
              label: t('MoM left position'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_COMPARISON1_LEFT,
              description: t('Horizontal offset in pixels from the left edge.'),
              visibility: ({ controls }) =>
                controls?.show_comparison1?.value === true,
            },
          },
        ],
        [
          <ControlSubSectionHeader>
            {t('YoY Comparison')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'show_comparison2',
            config: {
              type: 'CheckboxControl',
              label: t('Show YoY comparison'),
              renderTrigger: true,
              default: true,
            },
          },
        ],
        [
          {
            name: 'comparison2_label',
            config: {
              type: 'TextControl',
              label: t('YoY label'),
              renderTrigger: true,
              default: t(DEFAULT_COMPARISON2_LABEL),
              visibility: ({ controls }) =>
                controls?.show_comparison2?.value === true,
            },
          },
        ],
        [
          {
            name: 'comparison2_left',
            config: {
              type: 'TextControl',
              label: t('YoY left position'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_COMPARISON2_LEFT,
              description: t('Horizontal offset in pixels from the left edge.'),
              visibility: ({ controls }) =>
                controls?.show_comparison2?.value === true,
            },
          },
        ],
        [
          <ControlSubSectionHeader>
            {t('Comparison Style')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'comparison_font_size',
            config: {
              type: 'TextControl',
              label: t('Comparison font size'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_COMPARISON_FONT_SIZE,
            },
          },
        ],
        [
          {
            name: 'comparison_top',
            config: {
              type: 'TextControl',
              label: t('Comparison top position'),
              isInt: true,
              renderTrigger: true,
              default: DEFAULT_COMPARISON_TOP,
              description: t('Vertical offset in pixels from the top edge.'),
            },
          },
        ],
        [
          {
            name: 'percent_difference_format',
            config: {
              ...sharedControls.y_axis_format,
              label: t('Percent difference format'),
              default: NumberFormats.PERCENT_2_POINT,
            },
          },
        ],
        [
          {
            name: 'comparison_positive_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Increase color'),
              renderTrigger: true,
              default: DEFAULT_COMPARISON_POSITIVE_COLOR,
            },
          },
        ],
        [
          {
            name: 'comparison_negative_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Decrease color'),
              renderTrigger: true,
              default: DEFAULT_COMPARISON_NEGATIVE_COLOR,
            },
          },
        ],
        [
          {
            name: 'comparison_zero_color',
            config: {
              type: 'ColorPickerControl',
              label: t('No change color'),
              renderTrigger: true,
              default: DEFAULT_COMPARISON_ZERO_COLOR,
            },
          },
        ],
        [
          {
            name: 'background_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Background color'),
              renderTrigger: true,
              default: DEFAULT_BACKGROUND_COLOR,
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;
