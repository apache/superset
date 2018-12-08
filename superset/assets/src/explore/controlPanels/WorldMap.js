import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['entity'],
        ['country_fieldtype'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Bubbles'),
      controlSetRows: [
        ['show_bubbles'],
        ['secondary_metric'],
        ['max_bubble_size'],
      ],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('Country Control'),
      description: t('3 letter code of the country'),
    },
    metric: {
      label: t('Metric for color'),
      description: t('Metric that defines the color of the country'),
    },
    secondary_metric: {
      label: t('Bubble size'),
      description: t('Metric that defines the size of the bubble'),
    },
  },
};
