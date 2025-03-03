// DODO was here
import { t, validateNonEmpty } from '@superset-ui/core';
import { ControlPanelConfig } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        [
          {
            name: 'groupby',
            override: {
              validators: [validateNonEmpty],
            },
          },
        ],
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
      label: t('Parameters'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'significance_level',
            config: {
              type: 'TextControl',
              label: t('Significance Level'),
              default: 0.05,
              description: t(
                'Threshold alpha level for determining significance',
              ),
            },
          },
        ],
        [
          {
            name: 'pvalue_precision',
            config: {
              type: 'TextControl',
              label: t('p-value precision'),
              default: 6,
              description: t(
                'Number of decimal places with which to display p-values',
              ),
            },
          },
        ],
        [
          {
            name: 'liftvalue_precision',
            config: {
              type: 'TextControl',
              label: t('Lift percent precision'),
              default: 4,
              description: t(
                'Number of decimal places with which to display lift values',
              ),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
