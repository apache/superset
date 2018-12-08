import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series'],
        ['metrics'],
        ['secondary_metric'],
        ['adhoc_filters'],
        ['limit', 'row_limit'],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        ['show_datatable', 'include_series'],
        ['linear_color_scheme'],
      ],
    },
  ],
};
