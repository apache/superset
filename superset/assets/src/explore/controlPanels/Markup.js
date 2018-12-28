import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Code'),
      expanded: true,
      controlSetRows: [
        ['markup_type'],
        ['code'],
      ],
    },
  ],
};
