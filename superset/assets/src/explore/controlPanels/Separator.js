import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Code'),
      controlSetRows: [
        ['markup_type'],
        ['code'],
      ],
    },
  ],
  controlOverrides: {
    code: {
      default: '####Section Title\n' +
      'A paragraph describing the section' +
      'of the dashboard, right before the separator line ' +
      '\n\n' +
      '---------------',
    },
  },
};
