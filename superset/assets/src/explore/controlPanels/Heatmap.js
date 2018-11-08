import { t } from '@superset-ui/translation';
import { nonEmpty } from '../validators';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['all_columns_x', 'all_columns_y'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Heatmap Options'),
      expanded: true,
      controlSetRows: [
        ['linear_color_scheme'],
        ['xscale_interval', 'yscale_interval'],
        ['canvas_image_rendering', 'normalize_across'],
        ['left_margin', 'bottom_margin'],
        ['y_axis_bounds', 'y_axis_format'],
        ['show_legend', 'show_perc'],
        ['show_values', 'normalized'],
        ['sort_x_axis', 'sort_y_axis'],
      ],
    },
  ],
  controlOverrides: {
    all_columns_x: {
      validators: [nonEmpty],
    },
    all_columns_y: {
      validators: [nonEmpty],
    },
    normalized: t('Whether to apply a normal distribution based on rank on the color scale'),
    y_axis_bounds: {
      label: t('Value bounds'),
      renderTrigger: true,
      description: t(
        'Hard value bounds applied for color coding. Is only relevant ' +
        'and applied when the normalization is applied against the whole heatmap.'),
    },
    y_axis_format: {
      label: t('Value Format'),
    },
  },
};
