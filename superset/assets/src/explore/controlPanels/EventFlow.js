import { t } from '@superset-ui/translation';
import { nonEmpty } from '../validators';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Event definition'),
      controlSetRows: [
        ['entity'],
        ['all_columns_x'],
        ['row_limit'],
        ['order_by_entity'],
        ['min_leaf_node_event_count'],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Additional metadata'),
      controlSetRows: [
        ['all_columns'],
      ],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('Column containing entity ids'),
      description: t('e.g., a "user id" column'),
    },
    all_columns_x: {
      label: t('Column containing event names'),
      validators: [nonEmpty],
      default: control => (
        control.choices && control.choices.length > 0 ?
          control.choices[0][0] : null
      ),
    },
    row_limit: {
      label: t('Event count limit'),
      description: t('The maximum number of events to return, equivalent to the number of rows'),
    },
    all_columns: {
      label: t('Meta data'),
      description: t('Select any columns for metadata inspection'),
    },
  },
};
