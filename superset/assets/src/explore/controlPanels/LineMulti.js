import { t } from '@superset-ui/translation';
import { annotations } from './sections';
import { D3_TIME_FORMAT_OPTIONS } from '../controls';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ['prefix_metric_with_slice_name', null],
        ['show_legend', 'show_markers'],
        ['line_interpolation', null],
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
      label: t('Y Axis 1'),
      expanded: true,
      controlSetRows: [
        ['line_charts', 'y_axis_format'],
      ],
    },
    {
      label: t('Y Axis 2'),
      expanded: false,
      controlSetRows: [
        ['line_charts_2', 'y_axis_2_format'],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['adhoc_filters'],
      ],
    },
    annotations,
  ],
  controlOverrides: {
    line_charts: {
      label: t('Left Axis chart(s)'),
      description: t('Choose one or more charts for left axis'),
    },
    y_axis_format: {
      label: t('Left Axis Format'),
    },
    x_axis_format: {
      choices: D3_TIME_FORMAT_OPTIONS,
      default: 'smart_date',
    },
  },
  sectionOverrides: {
    sqlaTimeSeries: {
      controlSetRows: [
        ['time_range'],
      ],
    },
    druidTimeSeries: {
      controlSetRows: [
        ['time_range'],
      ],
    },
  },
};
