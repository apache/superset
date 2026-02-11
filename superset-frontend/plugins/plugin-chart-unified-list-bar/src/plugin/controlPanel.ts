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
import { validateNonEmpty } from '@superset-ui/core';
import { ControlPanelConfig, sections, sharedControls } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
    controlPanelSections: [
        sections.legacyTimeseriesTime,
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'key_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Key Column'),
                            description: t('Primary identifier for the row (displayed bold on the left)'),
                            multi: false,
                            validators: [validateNonEmpty],
                        },
                    },
                ],
                [
                    {
                        name: 'key_sub_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Key Sub Column'),
                            description: t('Optional sub-text below the key column'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'secondary_columns',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Secondary Columns'),
                            description: t('Additional fields to display'),
                            multi: true,
                            maxItems: 5,
                        },
                    },
                ],
                [
                    {
                        name: 'metric_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Metric Column'),
                            description: t('Numeric field for bar and value display'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'max_metric_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Max Metric Column'),
                            description: t('Optional column for calculating bar percentage'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'severity_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Severity Column'),
                            description: t('Column to determine severity icon (values 0=none, 1=warning, 2=error, 3=critical)'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'color_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Color Column'),
                            description: t('Column containing hex color codes for key and bar (e.g., ff5733)'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'display_value_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Display Value Column'),
                            description: t('Optional column for a numeric value to show on the right (e.g. Pour Count)'),
                            multi: false,
                        },
                    },
                ],
                ['adhoc_filters'],
                ['row_limit'],
            ],
        },
        {
            label: t('Layout'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'rows_per_item',
                        config: {
                            type: 'SelectControl',
                            label: t('Rows per Item'),
                            default: '2',
                            choices: [
                                ['1', '1 Row'],
                                ['2', '2 Rows'],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'align_metric',
                        config: {
                            type: 'SelectControl',
                            label: t('Align Metric'),
                            default: 'right',
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
                        name: 'show_bar',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Bar'),
                            default: true,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_metric_value',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Metric Value'),
                            default: true,
                            renderTrigger: true,
                        },
                    },
                ],
            ],
        },
        {
            label: t('Styling'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'key_font_size',
                        config: {
                            type: 'TextControl',
                            label: t('Key Font Size'),
                            default: 16,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'key_color',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('Key Color'),
                            default: { r: 0, g: 0, b: 0, a: 1 },
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'key_sub_font_size',
                        config: {
                            type: 'TextControl',
                            label: t('Key Sub Font Size'),
                            default: 11,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'secondary_font_size',
                        config: {
                            type: 'TextControl',
                            label: t('Secondary Font Size'),
                            default: 12,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'display_value_font_size',
                        config: {
                            type: 'TextControl',
                            label: t('Display Value Font Size'),
                            default: 24,
                            renderTrigger: true,
                            isInt: true,
                        },
                    },
                ],
                [
                    {
                        name: 'bar_color_positive',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('Bar Color (Positive)'),
                            default: { r: 50, g: 200, b: 50, a: 1 },
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'conditional_color_rules',
                        config: {
                            type: 'TextControl',
                            label: t('Conditional Color Rules (JSON)'),
                            description: t('e.g. [{"value": 10, "color": "red"}]'),
                            renderTrigger: true,
                        }
                    }
                ],
                [
                    {
                        name: 'icon_rules',
                        config: {
                            type: 'TextControl',
                            label: t('Icon Rules (JSON)'),
                            description: t('e.g. [{"value": 0, "icon": "check", "color": "green"}]'),
                            renderTrigger: true,
                        }
                    }
                ]
            ],
        },
    ],
};

export default config;
