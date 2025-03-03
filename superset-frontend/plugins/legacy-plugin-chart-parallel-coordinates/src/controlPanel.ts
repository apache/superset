// DODO was here
import { t } from '@superset-ui/core';
import { ControlPanelConfig } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series'],
        ['metrics'],
        ['secondary_metric'],
        ['adhoc_filters'],
        ['limit', 'row_limit'],
        ['series_limit_metric'], // DODO changed 45525377
        ['order_desc'],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_datatable',
            config: {
              type: 'CheckboxControl',
              label: t('Data Table'),
              default: false,
              renderTrigger: true,
              description: t('Whether to display the interactive data table'),
            },
          },
          {
            name: 'include_series',
            config: {
              type: 'CheckboxControl',
              label: t('Include Series'),
              renderTrigger: true,
              default: false,
              description: t('Include series name as an axis'),
            },
          },
        ],
        ['linear_color_scheme'],
      ],
    },
  ],
};

export default config;
