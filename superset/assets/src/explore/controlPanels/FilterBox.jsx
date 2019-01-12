import React from 'react';
import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Filters Configuration'),
      expanded: true,
      controlSetRows: [
        ['filter_configs'],
        [<hr />],
        ['date_filter', 'instant_filtering'],
        ['show_sqla_time_granularity', 'show_sqla_time_column'],
        ['show_druid_time_granularity', 'show_druid_time_origin'],
        ['adhoc_filters'],
      ],
    },
  ],
  controlOverrides: {
    adhoc_filters: {
      label: t('Global Filters'),
      description: t(
        'These filters, like the time filters, will be applied ' +
        'to each individual filters as the values are populated.'),
    },
  },
};
