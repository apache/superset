import { t } from '@superset-ui/translation';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        ['deck_slices', null],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['adhoc_filters'],
      ],
    },
  ],
};
