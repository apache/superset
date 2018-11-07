import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['columns'],
        ['row_limit', null],
      ],
    },
    {
      label: t('Pivot Options'),
      controlSetRows: [
        ['pandas_aggfunc', 'pivot_margins'],
        ['number_format', 'combine_metric'],
      ],
    },
  ],
  controlOverrides: {
    groupby: { includeTime: true },
    columns: { includeTime: true },
  },
};
