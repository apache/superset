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
      expanded: false,
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
            name: 'segmentAmt',
            config: {
              type: 'SliderControl',
              default: DEFAULT_FORM_DATA.segmentAmt,
              min: 1,
              max: 10,
              step: 1,
              renderTrigger: false,
              label: t('Amount of Segments'),
              description: t('Select the amount of segments the 2nd chart will have'),
            }
          },
        ],
        [<ControlSubSectionHeader>{t('Segement 1')}</ControlSubSectionHeader>],
        [
          {
            name: 's1_chartColor', // Unique name for the control
            config: {
              type: 'ColorPickerControl', // Type set to ColorPickerControl
              default: '#02F702',
              label: t('Chart Color'), // Label for the control
              description: t('Select the color for the chart'), // Description
              renderTrigger: true,
            },
          },
          {
            name: 's1_start',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s1_start,
              label: t('Starting point'),
              description: t('The Starting degrees of the first segment'),
            }
          },
          {
            name: 's1_end',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s1_end,
              label: t('Ending point'),
              description: t('The Ending degrees of the first segment'),
            }
          },
        ],
        [<ControlSubSectionHeader>{t('Segement 2')}</ControlSubSectionHeader>],
        [
          {
            name: 's2_chartColor', // Unique name for the control
            config: {
              type: 'ColorPickerControl', // Type set to ColorPickerControl
              default: '#FFA80D',
              label: t('Chart Color'), // Label for the control
              description: t('Select the color for the chart'), // Description
              renderTrigger: true,
            },
          },
          {
            name: 's2_start',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s2_start,
              label: t('Starting point'),
              description: t('The Starting degrees of the Second segment'),
            }
          },
          {
            name: 's2_end',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s2_end,
              label: t('Ending point'),
              description: t('The Ending degrees of the Second segment'),
            }
          },
        ],
        [<ControlSubSectionHeader>{t('Segement 3')}</ControlSubSectionHeader>],
        [
          {
            name: 's3_chartColor', // Unique name for the control
            config: {
              type: 'ColorPickerControl', // Type set to ColorPickerControl
              default: '#FF0000',
              label: t('Chart Color'), // Label for the control
              description: t('Select the color for the chart'), // Description
              renderTrigger: true,
            },
          },
          {
            name: 's3_start',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s3_start,
              label: t('Starting point'),
              description: t('The Starting degrees of the third segment'),
            }
          },
          {
            name: 's3_end',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s3_end,
              label: t('Ending point'),
              description: t('The Ending degrees of the third segment'),
            }
          },
        ],
      ],
    }
  ]
}

export default config;