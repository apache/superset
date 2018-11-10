import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['all_columns_x'],
        ['adhoc_filters'],
        ['row_limit'],
        ['groupby'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ['link_length'],
        ['x_axis_label', 'y_axis_label'],
        ['global_opacity'],
        ['normalized'],
      ],
    },
  ],
  controlOverrides: {
    all_columns_x: {
      label: t('Numeric Columns'),
      description: t('Select the numeric columns to draw the histogram'),
      multi: true,
    },
    link_length: {
      label: t('No of Bins'),
      description: t('Select the number of bins for the histogram'),
      default: 5,
    },
    global_opacity: {
      description: t('Opacity of the bars. Between 0 and 1'),
      renderTrigger: true,
    },
  },
};
