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
import {
    sharedControls,
    ControlPanelConfig,
    ControlSubSectionHeader,
    D3_FORMAT_OPTIONS,
    getStandardizedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';

const config: ControlPanelConfig = {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'groupby',
                        config: {
                            ...sharedControls.groupby,
                            description: t('Columns to group by'),
                        },
                    },
                ],
                ['metric'],
                ['adhoc_filters'],
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
                ['sort_by_metric'],
            ],
        },
        {
            label: t('Gauge Appearance'),
            expanded: true,
            controlSetRows: [
                [<ControlSubSectionHeader>{t('General')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'min_val',
                        config: {
                            type: 'TextControl',
                            isInt: true,
                            default: DEFAULT_FORM_DATA.minVal,
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
                            label: t('Start Angle'),
                            default: DEFAULT_FORM_DATA.startAngle,
                            renderTrigger: true,
                            description: t('Start angle of the gauge arc.'),
                        },
                    },
                    {
                        name: 'end_angle',
                        config: {
                            type: 'TextControl',
                            label: t('End Angle'),
                            default: DEFAULT_FORM_DATA.endAngle,
                            renderTrigger: true,
                            description: t('End angle of the gauge arc.'),
                        },
                    },
                ],
                [
                    {
                        name: 'inner_radius',
                        config: {
                            type: 'SliderControl',
                            label: t('Inner Radius (%)'),
                            default: 75,
                            min: 0,
                            max: 100,
                            renderTrigger: true,
                            description: t('Inner radius of the gauge arc.'),
                        },
                    },
                    {
                        name: 'arc_thickness',
                        config: {
                            type: 'SliderControl',
                            label: t('Arc Thickness'),
                            default: 30,
                            min: 1,
                            max: 50,
                            renderTrigger: true,
                            description: t('Thickness of the gauge arc.'),
                        },
                    },
                ],
                [<ControlSubSectionHeader>{t('Color Settings')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'color_mode',
                        config: {
                            type: 'SelectControl',
                            label: t('Color Mode'),
                            default: 'default',
                            choices: [
                                ['default', 'Default (Theme)'],
                                ['single', 'Single Color'],
                                ['multi', 'Multi Range'],
                            ],
                            renderTrigger: true,
                            description: t('Choose how to color the gauge arc.'),
                        },
                    },
                ],
                ['color_scheme'],
                [
                    {
                        name: 'single_color',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('Arc Color'),
                            default: { r: 0, g: 122, b: 204, a: 1 },
                            renderTrigger: true,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            visibility: ({ controls }: { controls: any }) => controls?.color_mode?.value === 'single',
                        },
                    },
                ],
                [
                    {
                        name: 'intervals',
                        config: {
                            type: 'TextControl',
                            label: t('Interval Bounds'),
                            default: '',
                            renderTrigger: true,
                            visibility: ({ controls }) => controls?.color_mode?.value === 'multi',
                            description: t('Comma-separated bounds (e.g. 20,80,100).'),
                        },
                    },
                ],
                [
                    {
                        name: 'interval_color_indices',
                        config: {
                            type: 'TextControl',
                            label: t('Interval Colors'),
                            default: '',
                            renderTrigger: true,
                            visibility: ({ controls }) => controls?.color_mode?.value === 'multi',
                            description: t('Comma-separated color indices (1-indexed) or hex codes.'),
                        },
                    },
                ],
                [
                    {
                        name: 'segment_style',
                        config: {
                            type: 'SelectControl',
                            label: t('Segment Style'),
                            default: 'smooth',
                            choices: [
                                ['smooth', 'Smooth'],
                                ['segmented', 'Segmented'],
                                ['rounded', 'Rounded'],
                            ],
                            renderTrigger: true,
                            description: t('Style of the arc segments.'),
                        },
                    },
                ],
                [<ControlSubSectionHeader>{t('Needle Settings')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'show_pointer',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Needle'),
                            default: DEFAULT_FORM_DATA.showPointer,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'needle_color',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('Needle Color'),
                            default: { r: 102, g: 102, b: 102, a: 1 },
                            renderTrigger: true,
                        },
                    },
                    {
                        name: 'needle_width',
                        config: {
                            type: 'SliderControl',
                            label: t('Needle Width'),
                            default: 5,
                            min: 1,
                            max: 20,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'needle_length',
                        config: {
                            type: 'SliderControl',
                            label: t('Needle Length (%)'),
                            default: 60,
                            min: 0,
                            max: 100,
                            renderTrigger: true,
                        },
                    },
                    {
                        name: 'needle_style',
                        config: {
                            type: 'SelectControl',
                            label: t('Needle Style'),
                            default: 'default',
                            choices: [
                                ['default', 'Default'],
                                ['rounded', 'Rounded'],
                                ['triangle', 'Triangle'],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [<ControlSubSectionHeader>{t('Value Display')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'show_center_val',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Center Value'),
                            default: true,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'center_val_size',
                        config: {
                            type: 'SliderControl',
                            label: t('Font Size'),
                            default: DEFAULT_FORM_DATA.fontSize,
                            min: 10,
                            max: 100,
                            renderTrigger: true,
                        },
                    },
                    {
                        name: 'center_val_weight',
                        config: {
                            type: 'SelectControl',
                            label: t('Font Weight'),
                            default: 'normal',
                            choices: [
                                ['normal', 'Normal'],
                                ['bold', 'Bold'],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'center_val_color',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('Value Color'),
                            default: { r: 0, g: 0, b: 0, a: 1 },
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'val_prefix',
                        config: {
                            type: 'TextControl',
                            label: t('Prefix'),
                            default: '',
                            renderTrigger: true,
                        },
                    },
                    {
                        name: 'val_suffix',
                        config: {
                            type: 'TextControl',
                            label: t('Suffix'),
                            default: '',
                            renderTrigger: true,
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
                ['currency_format'],
                [<ControlSubSectionHeader>{t('Ticks & Axis')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'show_axis_tick',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Ticks'),
                            default: DEFAULT_FORM_DATA.showAxisTick,
                            renderTrigger: true,
                        },
                    },
                    {
                        name: 'show_tick_labels',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Tick Labels'),
                            default: true,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'tick_density',
                        config: {
                            type: 'SelectControl',
                            label: t('Tick Density'),
                            default: 'medium',
                            choices: [
                                ['low', 'Low'],
                                ['medium', 'Medium'],
                                ['high', 'High'],
                            ],
                            renderTrigger: true,
                        },
                    },
                    {
                        name: 'show_split_line',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Split Lines'),
                            default: DEFAULT_FORM_DATA.showSplitLine,
                            renderTrigger: true,
                        },
                    },
                ],
                [<ControlSubSectionHeader>{t('Animation')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'animation',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Enable Animation'),
                            default: DEFAULT_FORM_DATA.animation,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'animation_duration',
                        config: {
                            type: 'SliderControl',
                            label: t('Duration (ms)'),
                            default: 1000,
                            min: 0,
                            max: 5000,
                            step: 100,
                            renderTrigger: true,
                        },
                    },
                ],
            ],
        },
    ],
    formDataOverrides: formData => ({
        ...formData,
        metric: getStandardizedControls().shiftMetric(),
        groupby: getStandardizedControls().popAllColumns(),
    }),
};

export default config;
