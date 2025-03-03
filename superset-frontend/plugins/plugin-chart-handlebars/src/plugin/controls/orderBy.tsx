// DODO was here
import { ControlSetItem, Dataset } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import { isEmpty } from 'lodash';
import { isAggMode, isRawMode } from './shared';

export const orderByControlSetItem: ControlSetItem = {
  name: 'order_by_cols',
  config: {
    type: 'SelectControl',
    label: t('Ordering'),
    description: t('Order results by selected columns'),
    multi: true,
    default: [],
    mapStateToProps: ({ datasource }) => ({
      choices: datasource?.hasOwnProperty('order_by_choices')
        ? (datasource as Dataset)?.order_by_choices
        : datasource?.columns || [],
    }),
    visibility: isRawMode,
    resetOnHide: false,
  },
};

export const orderDescendingControlSetItem: ControlSetItem = {
  name: 'order_desc',
  config: {
    type: 'CheckboxControl',
    label: t('Sort descending'),
    default: true,
    description: t('Whether to sort descending or ascending'),
    visibility: ({ controls }) =>
      !!(
        isAggMode({ controls }) &&
        // controls?.timeseries_limit_metric.value &&
        // !isEmpty(controls?.timeseries_limit_metric.value)
        // DODO changed 45525377
        controls?.series_limit_metric.value &&
        !isEmpty(controls?.series_limit_metric.value)
      ),
    resetOnHide: false,
  },
};
