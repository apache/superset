import { ControlSetItem } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import { isAggMode } from './shared';

export const includeTimeControlSetItem: ControlSetItem = {
  name: 'include_time',
  config: {
    type: 'CheckboxControl',
    label: t('Include time'),
    description: t(
      'Whether to include the time granularity as defined in the time section',
    ),
    default: false,
    visibility: isAggMode,
  },
};
