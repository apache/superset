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
  name: 'timeseries_limit_metric',
  override: {
    visibility: isAggMode,
  },
};
