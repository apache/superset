import { t } from '@superset-ui/core';
import {
  sharedControls,
  ControlPanelConfig,
  ControlSubSectionHeader,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';


// Add props for segmentAmt and setSegmentAmt
export function createSegmentControlCP(segmentAmt: number, rand:boolean) {
  console.log("In createSegment funct", segmentAmt)

  if(rand) {
    console.log("TP",segmentAmt)
  } else {
    console.log("CP",segmentAmt)
  }

  const segmentControls = [];
  for (let i = 1; i <= segmentAmt; i++) {
    segmentControls.push(
      [<ControlSubSectionHeader key={i}>{t('Segment ' + i)}</ControlSubSectionHeader>],
      [
        {
          name: 's${i}ChartColor', // Unique name for the control
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
    );
  }
  return segmentControls;
}

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
        ...createSegmentControlCP(DEFAULT_FORM_DATA.segmentAmt ?? 6, false),
    ]}
  ]
}

export default config;               
