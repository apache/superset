// DODO was here
import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  formatSelectOptions,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Time'),
      expanded: true,
      description: t('Time related form attributes'),
      controlSetRows: [['granularity_sqla'], ['time_range']],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['limit', 'series_limit_metric'], // DODO changed 45525377
        ['order_desc'],
        [
          {
            name: 'contribution',
            config: {
              type: 'CheckboxControl',
              label: t('Contribution'),
              default: false,
              description: t('Compute the contribution to the total'),
            },
          },
        ],
        ['row_limit', null],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'series_height',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              freeForm: true,
              label: t('Series Height'),
              default: '25',
              choices: formatSelectOptions([
                '10',
                '25',
                '40',
                '50',
                '75',
                '100',
                '150',
                '200',
              ]),
              description: t('Pixel height of each series'),
            },
          },
          {
            name: 'horizon_color_scale',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              label: t('Value Domain'),
              choices: [
                ['series', t('series')],
                ['overall', t('overall')],
                ['change', t('change')],
              ],
              default: 'series',
              description: t(
                'series: Treat each series independently; overall: All series use the same scale; change: Show changes compared to the first data point in each series',
              ),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
