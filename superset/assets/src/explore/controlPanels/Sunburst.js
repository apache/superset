import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        ['secondary_metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
      ],
    },
  ],
  controlOverrides: {
    metric: {
      label: t('Primary Metric'),
      description: t('The primary metric is used to define the arc segment sizes'),
    },
    secondary_metric: {
      label: t('Secondary Metric'),
      default: null,
      description: t('[optional] this secondary metric is used to ' +
      'define the color as a ratio against the primary metric. ' +
      'When omitted, the color is categorical and based on labels'),
    },
    groupby: {
      label: t('Hierarchy'),
      description: t('This defines the level of the hierarchy'),
    },
  },
};
