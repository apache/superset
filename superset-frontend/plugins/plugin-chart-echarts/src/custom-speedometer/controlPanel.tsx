import { t } from '@superset-ui/core';
import {
  sharedControls,
  ControlPanelConfig,
  ControlSubSectionHeader,
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
            name: 'segmentAmt',
            config: {
              type: 'SliderControl',
              default: DEFAULT_FORM_DATA.segmentAmt,
              min: 1,
              max: 10,
              step: 1,
              renderTrigger: true, // Make it true to trigger re-render on change
              label: t('Amount of Segments'),
              description: t('Select the amount of segments the 2nd chart will have'),
            },
          },
        ],
        [<ControlSubSectionHeader>{t('Segement 1')}</ControlSubSectionHeader>],
        [
          {
            name: 's1ChartColor', // Unique name for the control
            config: {
              type: 'ColorPickerControl', // Type set to ColorPickerControl
              default: DEFAULT_FORM_DATA.s1ChartColor,
              renderTrigger: true,
              label: t('Chart Color'), // Label for the control
              description: t('Select the color for the chart'), // Description
            },
          },        
          {
            name: 's1Start',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s1Start,
              renderTrigger: true,
              label: t('Start'),
              description: t('Start value of the first Segment'),
            },
          },
          {
            name: 's1End',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s1End,
              renderTrigger: true,
              label: t('Ending point'),
              description: t('The Ending degrees of the first segment'),
            }
          },        
        ],       
        [<ControlSubSectionHeader>{t('Segement 2')}</ControlSubSectionHeader>],
        [
          {
            name: 's2ChartColor', // Unique name for the control
            config: {
              type: 'ColorPickerControl', // Type set to ColorPickerControl
              default: DEFAULT_FORM_DATA.s2ChartColor,
              renderTrigger: true,
              label: t('Chart Color'), // Label for the control
              description: t('Select the color for the Second chart'), // Description
            },
          },        
          {
            name: 's2Start',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s2Start,
              renderTrigger: true,
              label: t('Start'),
              description: t('Start value of the Second Segment'),
            },
          },
          {
            name: 's2End',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s2End,
              renderTrigger: true,
              label: t('Ending point'),
              description: t('The Ending degrees of the Second segment'),
            }
          },
        ],
        [<ControlSubSectionHeader>{t('Segement 3')}</ControlSubSectionHeader>],
        [
          {
            name: 's3ChartColor', // Unique name for the control
            config: {
              type: 'ColorPickerControl', // Type set to ColorPickerControl
              default: DEFAULT_FORM_DATA.s3ChartColor,
              renderTrigger: true,
              label: t('Chart Color'), // Label for the control
              description: t('Select the color for the Third chart'), // Description
            },
          },        
          {
            name: 's3Start',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s3Start,
              renderTrigger: true,
              label: t('Start'),
              description: t('Start value of the Third Segment'),
            },
          },
          {
            name: 's3End',
            config: {
              type: 'TextControl',
              isInt: true,
              default: DEFAULT_FORM_DATA.s3End,
              renderTrigger: true,
              label: t('Ending point'),
              description: t('The Ending degrees of the Third segment'),
            }
          },
        ],              
    ]}
  ]
}

export default config;               
