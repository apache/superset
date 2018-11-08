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
        ['limit'],
        ['column_collection'],
        ['url'],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      multiple: false,
    },
    url: {
      description: t(
        "Templated link, it's possible to include {{ metric }} " +
        'or other values coming from the controls.'),
    },
  },
};
