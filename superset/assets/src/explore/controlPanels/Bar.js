import { t } from '@superset-ui/translation';
import { NVD3TimeSeries, annotations } from './sections';
import { D3_TIME_FORMAT_OPTIONS } from '../controls';

export default {
  requiresTime: true,
  controlPanelSections: [
    NVD3TimeSeries[0],
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ['show_brush', 'show_legend', 'show_bar_value'],
        ['rich_tooltip', 'bar_stacked'],
        ['line_interpolation', 'show_controls'],
        ['bottom_margin'],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        ['x_axis_label', 'bottom_margin'],
        ['x_ticks_layout', 'x_axis_format'],
        ['x_axis_showminmax', 'reduce_x_ticks'],
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
    NVD3TimeSeries[1],
    annotations,
  ],
  controlOverrides: {
    x_axis_format: {
      choices: D3_TIME_FORMAT_OPTIONS,
      default: 'smart_date',
    },
  },
};
