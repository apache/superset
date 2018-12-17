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
        ['show_brush', 'show_legend'],
        ['line_interpolation', 'stacked_style'],
        ['color_scheme'],
        ['rich_tooltip', 'show_controls'],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        ['x_axis_label', 'bottom_margin'],
        ['x_ticks_layout', 'x_axis_format'],
        ['x_axis_showminmax', null],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        ['y_axis_format', 'y_axis_bounds'],
        ['y_log_scale', null],
      ],
    },
    NVD3TimeSeries[1],
    annotations,
  ],
  controlOverrides: {
    x_axis_format: {
      default: 'smart_date',
      choices: D3_TIME_FORMAT_OPTIONS,
    },
    color_scheme: {
      renderTrigger: false,
    },
  },
};
