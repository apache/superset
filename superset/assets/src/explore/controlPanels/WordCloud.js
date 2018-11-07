import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit', null],
      ],
    },
    {
      label: t('Options'),
      controlSetRows: [
        ['size_from', 'size_to'],
        ['rotation'],
        ['color_scheme'],
      ],
    },
  ],
};
