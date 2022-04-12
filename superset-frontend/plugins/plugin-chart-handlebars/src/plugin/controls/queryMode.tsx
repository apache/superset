import {
  ControlConfig,
  ControlSetItem,
  QueryModeLabel,
} from '@superset-ui/chart-controls';
import { QueryMode, t } from '@superset-ui/core';
import { getQueryMode } from './shared';

const queryMode: ControlConfig<'RadioButtonControl'> = {
  type: 'RadioButtonControl',
  label: t('Query mode'),
  default: null,
  options: [
    [QueryMode.aggregate, QueryModeLabel[QueryMode.aggregate]],
    [QueryMode.raw, QueryModeLabel[QueryMode.raw]],
  ],
  mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
  rerender: ['all_columns', 'groupby', 'metrics', 'percent_metrics'],
};

export const queryModeControlSetItem: ControlSetItem = {
  name: 'query_mode',
  config: queryMode,
};
