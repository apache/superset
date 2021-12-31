import {
  ControlPanelsContainerProps,
  ControlSetItem,
  ControlSetRow,
} from '@superset-ui/chart-controls';
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import { PAGE_SIZE_OPTIONS } from '../../consts';

export const ServerPaginationControlSetRow: ControlSetRow =
  isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) ||
  isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS)
    ? [
        {
          name: 'server_pagination',
          config: {
            type: 'CheckboxControl',
            label: t('Server pagination'),
            description: t(
              'Enable server side pagination of results (experimental feature)',
            ),
            default: false,
          },
        },
      ]
    : [];

export const ServerPageLengthControlSetItem: ControlSetItem = {
  name: 'server_page_length',
  config: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Server Page Length'),
    default: 10,
    choices: PAGE_SIZE_OPTIONS,
    description: t('Rows per page, 0 means no pagination'),
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.server_pagination?.value),
  },
};
