import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Options'),
      controlSetRows: [
        ['link_length'],
        ['charge'],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Source / Target'),
      description: t('Choose a source and a target'),
    },
  },
};
