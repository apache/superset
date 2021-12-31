import { ControlSetItem } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import { isAggMode, isRawMode } from './shared';

export const OrderByControlSetItem: ControlSetItem = {
  name: 'order_by_cols',
  config: {
    type: 'SelectControl',
    label: t('Ordering'),
    description: t('Order results by selected columns'),
    multi: true,
    default: [],
    mapStateToProps: ({ datasource }) => ({
      choices: datasource?.order_by_choices || [],
    }),
    visibility: isRawMode,
  },
};

export const OrderDescendingControlSetItem: ControlSetItem = {
  name: 'order_desc',
  config: {
    type: 'CheckboxControl',
    label: t('Sort descending'),
    default: true,
    description: t('Whether to sort descending or ascending'),
    visibility: isAggMode,
  },
};
