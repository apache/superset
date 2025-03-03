// DODO was here
import { SMART_DATE_ID, t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  formatSelectOptions,
  sections,
  ControlPanelsContainerProps,
  sharedControls,
  D3_TIME_FORMAT_OPTIONS, // DODO added 45525377
  D3_FORMAT_DOCS, // DODO added 45525377
} from '@superset-ui/chart-controls';

import { DEFAULT_FORM_DATA } from './constants';
import {
  legendSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
} from '../controls';
import { defaultYAxis } from '../defaults';

const { logAxis, truncateYAxis, yAxisBounds, opacity } = DEFAULT_FORM_DATA;

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series'],
        ['entity'],
        ['x'],
        ['y'],
        ['adhoc_filters'],
        ['size'],
        ['orderby'],
        [
          {
            name: 'order_desc',
            config: {
              ...sharedControls.order_desc,
              visibility: ({ controls }) => Boolean(controls.orderby.value),
            },
          },
        ],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        ['color_scheme'],
        ...legendSection,
        [
          {
            name: 'max_bubble_size',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              freeForm: true,
              label: t('Max Bubble Size'),
              default: '25',
              choices: formatSelectOptions([
                '5',
                '10',
                '15',
                '25',
                '50',
                '75',
                '100',
              ]),
            },
          },
        ],
        [
          {
            name: 'tooltipSizeFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('Bubble size number format'),
            },
          },
        ],
        [
          {
            name: 'opacity',
            config: {
              type: 'SliderControl',
              label: t('Bubble Opacity'),
              renderTrigger: true,
              min: 0,
              max: 1,
              step: 0.1,
              default: opacity,
              description: t(
                'Opacity of bubbles, 0 means completely transparent, 1 means opaque',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'x_axis_label',
            config: {
              type: 'TextControl',
              label: t('X Axis Title'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [xAxisLabelRotation],
        [
          {
            name: 'x_axis_title_margin',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: true,
              label: t('X AXIS TITLE MARGIN'),
              renderTrigger: true,
              default: sections.TITLE_MARGIN_OPTIONS[1],
              choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
            },
          },
        ],
        // DODO added start 45525377
        [
          {
            name: 'x_force_timestamp_formatting',
            config: {
              type: 'CheckboxControl',
              label: t('Force date format'),
              renderTrigger: true,
              default: false,
              description: t(
                'Use date formatting even when metric value is not a timestamp',
              ),
            },
          },
        ],
        [
          {
            name: 'x_time_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: D3_FORMAT_DOCS,
              default: SMART_DATE_ID,
            },
          },
        ],
        // DODO added stop 45525377
        [
          {
            name: 'xAxisFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('X Axis Format'),
            },
          },
        ],
        [
          {
            name: 'logXAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic x-axis'),
              renderTrigger: true,
              default: logAxis,
              description: t('Logarithmic x-axis'),
            },
          },
        ],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'y_axis_label',
            config: {
              type: 'TextControl',
              label: t('Y Axis Title'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'yAxisLabelRotation',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: false,
              label: t('Rotate y axis label'),
              choices: [
                [0, '0°'],
                [45, '45°'],
              ],
              default: defaultYAxis.yAxisLabelRotation,
              renderTrigger: true,
              description: t(
                'Input field supports custom rotation. e.g. 30 for 30°',
              ),
            },
          },
        ],
        [
          {
            name: 'y_axis_title_margin',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: true,
              label: t('Y AXIS TITLE MARGIN'),
              renderTrigger: true,
              default: sections.TITLE_MARGIN_OPTIONS[1],
              choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
            },
          },
        ],
        // DODO added start 45525377
        [
          {
            name: 'y_force_timestamp_formatting',
            config: {
              type: 'CheckboxControl',
              label: t('Force date format'),
              renderTrigger: true,
              default: false,
              description: t(
                'Use date formatting even when metric value is not a timestamp',
              ),
            },
          },
        ],
        [
          {
            name: 'y_time_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: D3_FORMAT_DOCS,
              default: SMART_DATE_ID,
            },
          },
        ],
        // DODO added stop 45525377
        ['y_axis_format'],
        [
          {
            name: 'logYAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic y-axis'),
              renderTrigger: true,
              default: logAxis,
              description: t('Logarithmic y-axis'),
            },
          },
        ],
        [truncateXAxis],
        [xAxisBounds],
        [
          {
            name: 'truncateYAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Truncate Y Axis'),
              default: truncateYAxis,
              renderTrigger: true,
              description: t(
                'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
              ),
            },
          },
        ],
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: t('Y Axis Bounds'),
              renderTrigger: true,
              default: yAxisBounds,
              description: t(
                'Bounds for the Y-axis. When left empty, the bounds are ' +
                  'dynamically defined based on the min/max of the data. Note that ' +
                  "this feature will only expand the axis range. It won't " +
                  "narrow the data's extent.",
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.truncateYAxis?.value),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
