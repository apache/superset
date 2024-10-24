import { t } from '@superset-ui/core';
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
              description: t('Colums to group by')    
            }
          },
        ],
        ['metric'],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: {
              ...sharedControls.row_limit,
              
            }
          }
        ],
      ],
    },
    {
      label: t('Gauge Settings'), // New section label
      expanded: true,
      controlSetRows: [
        [<ControlSubSectionHeader>{t('General')}</ControlSubSectionHeader>],
        [
          {
            name: 'minValue',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.minValue,
              renderTrigger: true,
              label: t('Min'),
              description: t('Minimum value on the gauge axis'),
            },
          },
          {
            name: 'maxValue',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.maxValue,
              renderTrigger: true,
              label: t('Max'),
              description: t('Maximum value on the gauge axis'),
            },
          },
        ],
        [<ControlSubSectionHeader>{t('Segment Charts')}</ControlSubSectionHeader>],
        [
          {
            name: 'Segmentation',
            config: {
              type: 'SliderControl',
              default: 3,
              min: 0,
              max: 10,
              step: 1,
              renderTrigger: false,
              label: t('Amount of Segments'),
              description: t('Select the amount of segments the 2nd chart will have'),
            }
          },
        ]
      ],
    }
  ]
}

export default config;