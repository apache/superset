import {
  ControlPanelConfig,
  ControlSubSectionHeader,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import { GenericDataType, t } from '@superset-ui/core';
import {
  legendSection,
  showExtraControls,
  tooltipTimeFormatControl,
  tooltipValuesFormatControl,
} from '../controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'start_time',
            config: {
              ...sharedControls.entity,
              label: t('Start Time'),
              description: undefined,
              allowedDataTypes: [GenericDataType.Temporal],
            },
          },
        ],
        [
          {
            name: 'end_time',
            config: {
              ...sharedControls.entity,
              label: t('End Time'),
              description: undefined,
              allowedDataTypes: [GenericDataType.Temporal],
            },
          },
        ],
        [
          {
            name: 'y_axis',
            config: {
              ...sharedControls.x_axis,
              label: t('Y-axis'),
              description: t('Dimension to use on y-axis.'),
              initialValue: () => undefined,
            },
          },
        ],
        ['series'],
        [
          {
            name: 'subcategories',
            config: {
              type: 'CheckboxControl',
              label: t('Subcategories'),
              description: t(
                'Divides each category into subcategories based on the values in ' +
                  'the dimension. It can be used to exclude intersections.',
              ),
              renderTrigger: true,
              default: false,
              visibility: ({ controls }) => !!controls?.series?.value,
            },
          },
        ],
        ['tooltip_metrics'],
        ['tooltip_columns'],
        ['adhoc_filters'],
        ['order_by_cols'],
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
        ['zoomable'],
        [showExtraControls],
        [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
        [
          {
            name: 'x_axis_time_bounds',
            config: {
              type: 'TimeRangeControl',
              label: t('Bounds'),
              description: t(
                'Bounds for the X-axis. Selected time merges with ' +
                  'min/max date of the data. When left empty, bounds ' +
                  'dynamically defined based on the min/max of the data.',
              ),
              renderTrigger: true,
              allowClear: true,
              allowEmpty: [true, true],
            },
          },
        ],
        [
          {
            name: sections.xAxisTitleMarginControl.name,
            config: {
              ...sections.xAxisTitleMarginControl.config,
              default: 0,
            },
          },
        ],
        ['x_axis_time_format'],
        [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
        [
          {
            name: sections.yAxisTitleMarginControl.name,
            config: {
              ...sections.yAxisTitleMarginControl.config,
              default: 30,
            },
          },
        ],
        [<ControlSubSectionHeader>{t('Tooltip')}</ControlSubSectionHeader>],
        [tooltipTimeFormatControl],
        [tooltipValuesFormatControl],
      ],
    },
  ],
};

export default config;
