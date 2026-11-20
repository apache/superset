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

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: 'Banner content', expanded: true, controlSetRows: [
        [{ name: 'bannerTitle', config: { type: 'TextControl', label: 'Title', default: 'Hello..', renderTrigger: true } }],
        [{ name: 'bannerSubtitle', config: { type: 'TextControl', label: 'Subtitle', default: 'Typing your subtitle here...', renderTrigger: true } }],
        [{ name: 'bannerIcon', config: { type: 'TextControl', label: 'Icon or short label', description: 'Example: 🐰, 😂, Hi', default: '😶‍🌫️', renderTrigger: true } }],
        [{ name: 'showIcon', config: { type: 'CheckboxControl', label: 'Show icon', default: true, renderTrigger: true } }],
        [{ name: 'showClock', config: { type: 'CheckboxControl', label: 'Show clock', default: true, renderTrigger: true } }],
        [{ name: 'clockPosition', config: { type: 'SelectControl', label: 'Clock position', default: 'right', clearable: false, renderTrigger: true, choices: [['left', 'Left'], ['right', 'Right']] } }],
      ],
    },
    {
      label: 'Clock settings', expanded: true, controlSetRows: [
        [{ name: 'timezone', config: { type: 'TextControl', label: 'IANA time zone', default: 'America/Los_Angeles', renderTrigger: true } }],
        [{ name: 'locale', config: { type: 'TextControl', label: 'Locale', default: 'en-GB', renderTrigger: true } }],
        [{ name: 'datePattern', config: { type: 'SelectControl', label: 'Date pattern', default: 'weekday', clearable: false, renderTrigger: true, choices: [['weekday', 'Weekday and numeric date'], ['short', 'Short'], ['medium', 'Medium'], ['long', 'Long'], ['full', 'Full']] } }],
        [{ name: 'showDate', config: { type: 'CheckboxControl', label: 'Show date', default: true, renderTrigger: true } }],
        [{ name: 'showSeconds', config: { type: 'CheckboxControl', label: 'Show seconds', default: true, renderTrigger: true } }],
        [{ name: 'use24Hour', config: { type: 'CheckboxControl', label: 'Use 24-hour format', default: true, renderTrigger: true } }],
      ],
    },
    {
      label: 'Typography and spacing', expanded: true, controlSetRows: [
        [{ name: 'titleFontSize', config: { type: 'SliderControl', label: 'Title font size', default: 28, min: 12, max: 96, step: 1, renderTrigger: true } }],
        [{ name: 'subtitleFontSize', config: { type: 'SliderControl', label: 'Subtitle font size', default: 14, min: 8, max: 48, step: 1, renderTrigger: true } }],
        [{ name: 'clockFontSize', config: { type: 'SliderControl', label: 'Clock font size', default: 30, min: 12, max: 96, step: 1, renderTrigger: true } }],
        [{ name: 'iconFontSize', config: { type: 'SliderControl', label: 'Icon font size', default: 28, min: 12, max: 72, step: 1, renderTrigger: true } }],
        [{ name: 'horizontalPadding', config: { type: 'SliderControl', label: 'Horizontal padding', default: 24, min: 0, max: 100, step: 1, renderTrigger: true } }],
        [{ name: 'verticalPadding', config: { type: 'SliderControl', label: 'Vertical padding', default: 14, min: 0, max: 100, step: 1, renderTrigger: true } }],
        [{ name: 'borderRadius', config: { type: 'SliderControl', label: 'Border radius', default: 8, min: 0, max: 50, step: 1, renderTrigger: true } }],
      ],
    },
    {
      label: 'Colors', expanded: false, controlSetRows: [
        [{ name: 'backgroundColor', config: { type: 'TextControl', label: 'Background color', description: 'CSS color, e.g. transparent or #ffffff', default: 'transparent', renderTrigger: true } }],
        [{ name: 'titleColor', config: { type: 'TextControl', label: 'Title color', default: 'inherit', renderTrigger: true } }],
        [{ name: 'subtitleColor', config: { type: 'TextControl', label: 'Subtitle color', default: '#64748b', renderTrigger: true } }],
        [{ name: 'clockColor', config: { type: 'TextControl', label: 'Clock color', default: 'inherit', renderTrigger: true } }],
        [{ name: 'accentColor', config: { type: 'TextControl', label: 'Accent color', default: '#20a7c9', renderTrigger: true } }],
        [{ name: 'showBottomBorder', config: { type: 'CheckboxControl', label: 'Show accent bottom border', default: true, renderTrigger: true } }],
      ],
    },
  ],
};

export default config;
