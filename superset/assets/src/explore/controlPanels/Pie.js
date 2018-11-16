import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
        ['groupby'],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['pie_label_type'],
        ['donut', 'show_legend'],
        ['show_labels', 'labels_outside'],
        ['color_scheme'],
      ],
    },
  ],
  controlOverrides: {
    row_limit: {
      default: 25,
    },
  },
};
