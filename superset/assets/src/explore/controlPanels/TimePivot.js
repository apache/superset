import { t } from '@superset-ui/translation';
import { D3_TIME_FORMAT_OPTIONS } from '../controls';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
        ['freq'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['show_legend', 'line_interpolation'],
        ['color_picker', null],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        ['x_axis_label', 'bottom_margin'],
        ['x_axis_showminmax', 'x_axis_format'],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        ['y_axis_label', 'left_margin'],
        ['y_axis_showminmax', 'y_log_scale'],
        ['y_axis_format', 'y_axis_bounds'],
      ],
    },
  ],
  controlOverrides: {
    x_axis_format: {
      choices: D3_TIME_FORMAT_OPTIONS,
      default: 'smart_date',
    },
    metric: {
      clearable: false,
    },
  },
};
