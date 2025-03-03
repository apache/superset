// DODO was here
import {
  ControlPanelsContainerProps,
  ControlSetItem,
} from '@superset-ui/chart-controls';
import { isAggMode } from './shared';

export const rowLimitControlSetItem: ControlSetItem = {
  name: 'row_limit',
  override: {
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      !controls?.server_pagination?.value,
  },
};

export const timeSeriesLimitMetricControlSetItem: ControlSetItem = {
  name: 'series_limit_metric', // DODO changed 45525377
  override: {
    visibility: isAggMode,
    resetOnHide: false,
  },
};
