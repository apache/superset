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
                        name: 'status_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Status Column'),
                            description: t('Optional status text (displayed above key)'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'key_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Key Column'),
                            description: t('Primary identifier for the row'),
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
                        name: 'arrow_text_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Arrow Text Column'),
                            description: t('Text to display inside the arrow'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'arrow_color_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Arrow Color Column'),
                            description: t('Column containing hex color codes for the arrow'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'secondary_columns',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Secondary Column'),
                            description: t('First column on the right side'),
                            multi: true, // Keeping multi to be safe with types/legacy, but user said "Secondary and Tertiary" - actually user said "two more columns... secondary and tertiary". Multi might be easier if they want more, but request creates specific layout slots. I'll use multi for flexibility or stick to single if I want strict slots.
                            // The request says: "there will be two more columns which we will show as seconday and tertiary column."
                            // If I use multi, I can just take the first two.
                            // But I added `tertiaryColumn` to types. I should probably use `tertiary_column` control.
                            // So I will make this `secondary_column` (singular name in label, but maybe code uses `secondary_columns` array? I'll stick to `secondary_columns` for now to minimize breakage if I can't change types easily, but I DID change types).
                            // I'll make it `secondary_column` single select.
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'tertiary_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Tertiary Column'),
                            description: t('Second column on the right side'),
                            multi: false,
                        },
                    },
                ],
                [
                    {
                        name: 'end_column',
                        config: {
                            ...sharedControls.groupby,
                            label: t('End Column'),
                            description: t('Column displayed at the far right end'),
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
                            label: t('Right Columns Font Size'),
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
                            label: t('End Column Font Size'),
                            default: 24,
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
