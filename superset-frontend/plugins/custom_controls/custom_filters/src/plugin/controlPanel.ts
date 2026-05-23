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
// @ts-ignore
import { t } from '@apache-superset/core/translation';
import { ControlPanelConfig, sharedControls } from '@superset-ui/chart-controls';


const config: ControlPanelConfig = {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'filterColumn',
                        config: {
                            ...sharedControls.groupby,
                            label: t('Filter Column'),
                            description: t('Column to filter on and fetch options for. Options will be queried from this column.'),
                            multi: false,
                        },
                    },
                ],
                ['adhoc_filters'],
            ],
        },
        {
            label: t('Custom Controls'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'controlType',
                        config: {
                            type: 'SelectControl',
                            label: t('Control Type'),
                            default: 'Dropdown',
                            choices: [
                                ['Dropdown', 'Dropdown'],
                                ['Radio', 'Radio Buttons'],
                                ['Checkbox', 'Checkboxes'],
                                ['TextBox', 'Text Box'],
                            ],
                            renderTrigger: true,
                            description: t('Select the type of UI control to display'),
                        },
                    },
                ],
                [
                    {
                        name: 'orientation',
                        config: {
                            type: 'SelectControl',
                            label: t('Orientation'),
                            default: 'vertical',
                            choices: [
                                ['vertical', 'Vertical'],
                                ['horizontal', 'Horizontal'],
                            ],
                            renderTrigger: true,
                            description: t('Layout orientation for Radio/Checkbox controls'),
                        },
                    },
                ],
                [
                    {
                        name: 'includeAllOption',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Include "All" Option'),
                            default: false,
                            renderTrigger: true,
                            description: t('Add an "All" option to clear filters (useful for Radio buttons)'),
                        },
                    },
                ],
                [
                    {
                        name: 'multiSelect',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Allow Multiple Selections'),
                            default: true,
                            renderTrigger: true,
                            description: t('Allow users to select multiple options from the Dropdown at once.'),
                            visibility: ({ controls }: any) => controls?.controlType?.value === 'Dropdown',
                        },
                    },
                ],
                [
                    {
                        name: 'defaultValue',
                        config: {
                            type: 'TextControl',
                            label: t('Default Value'),
                            default: '',
                            renderTrigger: true,
                            description: t(
                                'Pre-selected default value shown on load. ' +
                                'For multi-select controls, separate multiple values with commas (e.g. "Value 1, Value 2"). ' +
                                'Cross-filter IS emitted for the default value on load. ' +
                                'Clearing back to default also clears the cross-filter.',
                            ),
                        },
                    },
                ],
                [
                    {
                        name: 'hideTitle',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Hide Title'),
                            default: false,
                            renderTrigger: true,
                            description: t('Hide the column name title above the control.'),
                        },
                    },
                ],
                [
                    {
                        name: 'boldTitle',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Bold Title'),
                            default: true,
                            renderTrigger: true,
                            description: t('Show the column title in bold.'),
                        },
                    },
                ],
            ],
        },
    ],
};


export default config;