import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['columns'],
        ['row_limit'],
        ['contribution'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ['show_legend', 'show_bar_value'],
        ['bar_stacked', 'order_bars'],
        ['y_axis_format', 'y_axis_label'],
        ['show_controls', null],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        ['x_axis_label', 'bottom_margin'],
        ['x_ticks_layout', 'reduce_x_ticks'],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Series'),
    },
    columns: {
      label: t('Breakdowns'),
      description: t('Defines how each series is broken down'),
    },
  },
};
