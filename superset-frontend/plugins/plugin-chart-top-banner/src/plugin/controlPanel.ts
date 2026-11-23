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

import { ControlPanelConfig } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Banner content'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'bannerTitle',
            config: {
              type: 'TextControl',
              label: t('Title'),
              default: 'Hello..',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'bannerSubtitle',
            config: {
              type: 'TextControl',
              label: t('Subtitle'),
              default: 'Typing your subtitle here...',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'bannerIcon',
            config: {
              type: 'TextControl',
              label: t('Icon or short label'),
              description: t('Example:smiley, rocket, or short text, Hi'),
              default: '\uD83D\uDE36\u200D\uD83C\uDF2B\uFE0F',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'showIcon',
            config: {
              type: 'CheckboxControl',
              label: t('Show icon'),
              default: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'showClock',
            config: {
              type: 'CheckboxControl',
              label: t('Show clock'),
              default: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'clockPosition',
            config: {
              type: 'SelectControl',
              label: t('Clock position'),
              default: 'right',
              clearable: false,
              renderTrigger: true,
              choices: [
                ['left', t('Left')],
                ['right', t('Right')],
              ],
            },
          },
        ],
      ],
    },
    {
      label: t('Clock settings'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'timezone',
            config: {
              type: 'TextControl',
              label: t('IANA time zone'),
              default: 'America/Los_Angeles',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'locale',
            config: {
              type: 'TextControl',
              label: t('Locale'),
              default: 'en-GB',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'datePattern',
            config: {
              type: 'SelectControl',
              label: t('Date pattern'),
              default: 'weekday',
              clearable: false,
              renderTrigger: true,
              choices: [
                ['weekday', t('Weekday and numeric date')],
                ['short', t('Short')],
                ['medium', t('Medium')],
                ['long', t('Long')],
                ['full', t('Full')],
              ],
            },
          },
        ],
        [
          {
            name: 'showDate',
            config: {
              type: 'CheckboxControl',
              label: t('Show date'),
              default: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'showSeconds',
            config: {
              type: 'CheckboxControl',
              label: t('Show seconds'),
              default: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'use24Hour',
            config: {
              type: 'CheckboxControl',
              label: t('Use 24-hour format'),
              default: true,
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Typography and spacing'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'titleFontSize',
            config: {
              type: 'SliderControl',
              label: t('Title font size'),
              default: 28,
              min: 12,
              max: 96,
              step: 1,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'subtitleFontSize',
            config: {
              type: 'SliderControl',
              label: t('Subtitle font size'),
              default: 14,
              min: 8,
              max: 48,
              step: 1,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'clockFontSize',
            config: {
              type: 'SliderControl',
              label: t('Clock font size'),
              default: 30,
              min: 12,
              max: 96,
              step: 1,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'iconFontSize',
            config: {
              type: 'SliderControl',
              label: t('Icon font size'),
              default: 28,
              min: 12,
              max: 72,
              step: 1,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'horizontalPadding',
            config: {
              type: 'SliderControl',
              label: t('Horizontal padding'),
              default: 24,
              min: 0,
              max: 100,
              step: 1,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'verticalPadding',
            config: {
              type: 'SliderControl',
              label: t('Vertical padding'),
              default: 14,
              min: 0,
              max: 100,
              step: 1,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'borderRadius',
            config: {
              type: 'SliderControl',
              label: t('Border radius'),
              default: 8,
              min: 0,
              max: 50,
              step: 1,
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Colors'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'backgroundColor',
            config: {
              type: 'TextControl',
              label: t('Background color'),
              description: t('Leave blank to use the dashboard theme color'),
              default: '',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'titleColor',
            config: {
              type: 'TextControl',
              label: t('Title color'),
              default: '',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'subtitleColor',
            config: {
              type: 'TextControl',
              label: t('Subtitle color'),
              default: '',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'clockColor',
            config: {
              type: 'TextControl',
              label: t('Clock color'),
              default: '',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'accentColor',
            config: {
              type: 'TextControl',
              label: t('Accent color'),
              default: '',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'showBottomBorder',
            config: {
              type: 'CheckboxControl',
              label: t('Show accent bottom border'),
              default: true,
              renderTrigger: true,
            },
          },
        ],
      ],
    },
  ],
};

export default config;
