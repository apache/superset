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
                            label: t('Filter Column (Temporal)'),
                            description: t('Temporal column to apply date filters to.'),
                            multi: false,
                        },
                    },
                ]
            ],
        },
        {
            label: t('Custom Date Picker Options'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'pickerType',
                        config: {
                            type: 'SelectControl',
                            label: t('Picker Type'),
                            default: 'DatePicker',
                            choices: [
                                ['DatePicker', 'Single Date Picker'],
                                ['RangePicker', 'Date Range Picker'],
                            ],
                            renderTrigger: true,
                            description: t('Select the type of Date UI control to display'),
                        },
                    },
                ],
                [
                    {
                        name: 'showTime',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Enable Time Selection'),
                            default: false,
                            renderTrigger: true,
                            description: t('Allow users to select specific times (hours, minutes)'),
                        },
                    },
                ],
                [
                    {
                        name: 'presetRanges',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Enable Quick Preset Ranges'),
                            default: false,
                            renderTrigger: true,
                            description: t('Show handy presets like "Today", "Last 7 Days" on Range Pickers'),
                            visibility: ({ controls }: any) => controls?.pickerType?.value === 'RangePicker',
                        },
                    },
                ],
            ],
        },
        {
            label: t('Default Filters'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'defaultType',
                        config: {
                            type: 'SelectControl',
                            label: t('Default Value Type'),
                            default: 'None',
                            choices: [
                                ['None', 'No Default Filter'],
                                ['Static', 'Static Date / Range'],
                                ['Dynamic', 'Dynamic Preset (e.g. Last Month)'],
                            ],
                            renderTrigger: true,
                            description: t('Configure whether the chart loads with a pre-selected date.'),
                        },
                    },
                ],
                [
                    {
                        name: 'defaultStaticValue',
                        config: {
                            type: 'TextControl',
                            label: t('Static Default Value'),
                            description: t('For single dates: YYYY-MM-DD. For ranges: YYYY-MM-DD and YYYY-MM-DD'),
                            renderTrigger: true,
                            visibility: ({ controls }: any) => controls?.defaultType?.value === 'Static',
                        },
                    },
                ],
                [
                    {
                        name: 'defaultDynamicValue',
                        config: {
                            type: 'SelectControl',
                            label: t('Dynamic Preset Default'),
                            default: 'Last 30 Days',
                            choices: [
                                ['Today', 'Today'],
                                ['Yesterday', 'Yesterday'],
                                ['Last 7 Days', 'Last 7 Days'],
                                ['Last 30 Days', 'Last 30 Days'],
                                ['This Month', 'This Month (From 1st to Now)'],
                                ['This Month (Full)', 'This Month (Full Calendar Month)'],
                                ['Last Month', 'Last Month (Previous Calendar Month)'],
                                ['This Year', 'This Year'],
                            ],
                            renderTrigger: true,
                            description: t('Select a dynamic time range preset that computes on load.'),
                            visibility: ({ controls }: any) => controls?.defaultType?.value === 'Dynamic',
                        },
                    },
                ]
            ],
        },
    ],
};


export default config;
