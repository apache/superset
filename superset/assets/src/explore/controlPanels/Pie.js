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
        ['pie_label_type', 'number_format'],
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
    number_format: {
      description: (
        t('D3 format syntax: https://github.com/d3/d3-format') + ' ' +
        t('Only applies when the "Label Type" is not set to a percentage.')
      ),
    },
  },
};
