import { t } from '@superset-ui/translation';

export default {
  requiresTime: false,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['ranges', 'range_labels'],
        ['markers', 'marker_labels'],
        ['marker_lines', 'marker_line_labels'],
      ],
    },
  ],
};
