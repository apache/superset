import { t } from '@superset-ui/translation';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['domain_granularity', 'subdomain_granularity'],
        ['metrics'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['linear_color_scheme'],
        ['cell_size', 'cell_padding'],
        ['cell_radius', 'steps'],
        ['y_axis_format', 'x_axis_time_format'],
        ['show_legend', 'show_values'],
        ['show_metric_name', null],
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number Format'),
    },
    x_axis_time_format: {
      label: t('Time Format'),
    },
    show_values: {
      default: false,
    },
  },
};
