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
import { t } from '@apache-superset/core';
import { ControlPanelConfig, sections, sharedControls } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
    controlPanelSections: [
        sections.legacyTimeseriesTime,
        // ─── Query Section ───────────────────────────────────────────────
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'title_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Title Column'),
                            description: t('Column to display as the bar title'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'subtitle_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Subtitle Column'),
                            description: t('Column to display as subtitle text'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'kpi_columns',
                        config: {
                            ...sharedControls.groupby,
                            label: t('KPI Columns'),
                            description: t('Columns containing KPI values to display'),
                            multi: true,
                            maxItems: 10,
                        },
                    },
                ],
                [
                    {
                        name: 'ticker_message_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Ticker Message Column'),
                            description: t('Column containing notification messages for the ticker'),
                            multi: false,
                        },
                    },
                ],
                ['adhoc_filters'],
                ['row_limit'],
            ],
        },
        // ─── Layout Section ──────────────────────────────────────────────
        {
            label: t('Layout'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'layout_mode',
                        config: {
                            type: 'SelectControl',
                            label: t('Layout Mode'),
                            description: t('How the utility bar renders: header (top of chart cell), overlay (fixed portal), or inline (flows with content)'),
                            default: 'header',
                            choices: [
                                ['header', 'Header'],
                                ['overlay', 'Overlay'],
                                ['inline', 'Inline'],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'overlay_position',
                        config: {
                            type: 'SelectControl',
                            label: t('Overlay Position'),
                            description: t('Position of the overlay bar (only applies when Layout Mode is "overlay")'),
                            default: 'top',
                            choices: [
                                ['top', 'Top'],
                                ['bottom', 'Bottom'],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'overlay_z_index',
                        config: {
                            type: 'TextControl',
                            label: t('Overlay Z-Index'),
                            description: t('CSS z-index for the overlay bar'),
                            default: 1000,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'overlay_animation',
                        config: {
                            type: 'SelectControl',
                            label: t('Overlay Animation'),
                            description: t('Animation style when overlay bar appears'),
                            default: 'slide',
                            choices: [
                                ['slide', 'Slide In'],
                                ['fade', 'Fade In'],
                                ['none', 'None'],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
            ],
        },
        // ─── Elements Section ────────────────────────────────────────────
        {
            label: t('Elements'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'show_title',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Title'),
                            default: true,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_subtitle',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Subtitle'),
                            default: false,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_clock',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Live Clock'),
                            description: t('Display a live clock that updates every second'),
                            default: false,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_date',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Date'),
                            description: t('Display the current date'),
                            default: false,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_weather',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Weather'),
                            description: t('Display live weather using browser location (Open-Meteo API, no key required)'),
                            default: false,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_kpi',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show KPI Values'),
                            description: t('Display KPI values from the selected columns'),
                            default: true,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_ticker',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Notification Ticker'),
                            description: t('Display a horizontally scrolling notification ticker'),
                            default: false,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_custom_right_slot',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Custom Right Slot'),
                            description: t('Show a custom slot on the right side of the bar'),
                            default: false,
                            renderTrigger: true,
                        },
                    },
                ],
            ],
        },
        // ─── Ticker Section ─────────────────────────────────────────────
        {
            label: t('Ticker Settings'),
            expanded: false,
            controlSetRows: [
                [
                    {
                        name: 'ticker_speed',
                        config: {
                            type: 'TextControl',
                            label: t('Ticker Speed (seconds)'),
                            description: t('Duration in seconds for one full scroll cycle'),
                            default: 20,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'ticker_direction',
                        config: {
                            type: 'SelectControl',
                            label: t('Ticker Direction'),
                            default: 'left',
                            choices: [
                                ['left', 'Left'],
                                ['right', 'Right'],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'ticker_separator',
                        config: {
                            type: 'TextControl',
                            label: t('Ticker Separator'),
                            description: t('Character(s) to separate ticker messages'),
                            default: '  •  ',
                            renderTrigger: true,
                        },
                    },
                ],
            ],
        },
        // ─── Behavior Section ───────────────────────────────────────────
        {
            label: t('Behavior'),
            expanded: false,
            controlSetRows: [
                [
                    {
                        name: 'auto_hide_no_data',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Auto-hide When No Data'),
                            description: t('Hide the bar entirely when the query returns no rows'),
                            default: false,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'auto_hide_seconds',
                        config: {
                            type: 'TextControl',
                            label: t('Auto-hide After (seconds)'),
                            description: t('Automatically hide the bar after this many seconds (0 = never)'),
                            default: 0,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
            ],
        },
        // ─── Styling Section ────────────────────────────────────────────
        {
            label: t('Styling'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'background_color',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('Background Color'),
                            default: { r: 30, g: 30, b: 30, a: 0.95 },
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'text_color',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('Text Color'),
                            default: { r: 255, g: 255, b: 255, a: 1 },
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'title_font_size',
                        config: {
                            type: 'TextControl',
                            label: t('Title Font Size'),
                            description: t('Font size in pixels for the title text'),
                            default: 15,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'date_font_size',
                        config: {
                            type: 'TextControl',
                            label: t('Date Font Size'),
                            description: t('Font size in pixels for the date display'),
                            default: 11,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'clock_font_size',
                        config: {
                            type: 'TextControl',
                            label: t('Clock Font Size'),
                            description: t('Font size in pixels for the live clock'),
                            default: 16,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'weather_icon_size',
                        config: {
                            type: 'TextControl',
                            label: t('Weather Icon Size'),
                            description: t('Font size in pixels for the weather emoji icon'),
                            default: 18,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_temperature',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Temperature'),
                            description: t('Display the temperature value next to the weather icon'),
                            default: true,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'temperature_font_size',
                        config: {
                            type: 'TextControl',
                            label: t('Temperature Font Size'),
                            description: t('Font size in pixels for the temperature text'),
                            default: 13,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
            ],
        },
    ],
};

export default config;
