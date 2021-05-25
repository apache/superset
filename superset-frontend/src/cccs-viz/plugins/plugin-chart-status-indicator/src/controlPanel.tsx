import { t } from '@superset-ui/core';
import {
  formatSelectOptions,
  D3_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './constants';
import { jsFunctionControl } from './utils';


export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      tabOverride: 'data',
      controlSetRows: [
        ['groupby'],
        ['metrics'],
        ['adhoc_filters'],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort descending'),
              default: DEFAULT_FORM_DATA.order_desc,
              description: t('Whether to sort descending or ascending'),
            },
          },
        ],
        [
          {
            name: 'data_color_mapper',
            config: jsFunctionControl(
              t('Data color mapper'),
              t(
                'Define a javascript function that receives the data array used in the visualization ' +
                  'and is expected to return a hex color code which will be used as the background color. ',
              ),
              null,
              100,
              DEFAULT_FORM_DATA.data_color_mapper,
            ),
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'markdown',
            config: {
              type: 'TextAreaControl',
              label: t('Markdown'),
              default: DEFAULT_FORM_DATA.markdown,
              language: 'markdown',
              offerEditInModal: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'text_color',
            config: {
              type: 'SelectControl',
              label: t('Text Color'),
              choices: formatSelectOptions(['light', 'dark']),
              default: DEFAULT_FORM_DATA.text_color,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'number_format',
            config: {
              type: 'SelectControl',
              label: t('Number format'),
              description: 'D3 format syntax: https://github.com/d3/d3-format',
              freeForm: true,
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.number_format,
              choices: D3_FORMAT_OPTIONS,
            },
          },
        ],
        [
          {
            name: 'orientation',
            config: {
              type: 'SelectControl',
              label: t('Orientation'),
              description: 'How to align multiple indicators',
              choices: formatSelectOptions(['horizontal', 'vertical']),
              default: DEFAULT_FORM_DATA.orientation,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'rounded_corners',
            config: {
              type: 'CheckboxControl',
              label: t('Rounded Corners'),
              default: DEFAULT_FORM_DATA.rounded_corners,
              renderTrigger: true,
            },
          },
        ],
      ],
    },
  ],
};
