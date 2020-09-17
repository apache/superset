import React from 'react';
import { ColumnOption, t } from '@superset-ui/core';

export const controlPanelSectionsChartOptions = [
  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [
      [
        'color_scheme',
        {
          name: 'rose_area_proportion',
          config: {
            type: 'CheckboxControl',
            label: t('Use Area Proportions'),
            description: t(
              'Check if the Rose Chart should use segment area instead of ' +
                'segment radius for proportioning',
            ),
            default: false,
            renderTrigger: true,
          },
        },
      ],
      [
        {
          name: 'stacked_style',
          config: {
            type: 'SelectControl',
            label: t('Stacked Style'),
            renderTrigger: true,
            choices: [
              ['stack', 'stack'],
              ['stream', 'stream'],
              ['expand', 'expand'],
            ],
            default: 'stack',
            description: '',
          },
        },
      ],
    ],
  },
];

export const controlPanelSectionsChartOptionsOnlyColorScheme = [
  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [['color_scheme']],
  },
];

export const controlPanelSectionsChartOptionsTable = [
  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [
      [
        'metric',
        'metrics',
        {
          name: 'all_columns',
          config: {
            type: 'SelectControl',
            queryField: 'columns',
            multi: true,
            label: t('Columns'),
            default: [],
            description: t('Columns to display'),
            optionRenderer: c => <ColumnOption column={c} showType />,
            valueRenderer: c => <ColumnOption column={c} />,
            valueKey: 'column_name',
            allowAll: true,
            mapStateToProps: stateRef => ({
              options: stateRef.datasource ? stateRef.datasource.columns : [],
            }),
            commaChoosesOption: false,
            freeForm: true,
          },
        },
      ],
    ],
  },
];
