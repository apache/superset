import {
  ControlPanelsContainerProps,
  ControlSetItem,
} from '@superset-ui/chart-controls';
import { isAggMode } from './shared';

export const RowLimitControlSetItem: ControlSetItem = {
  name: 'row_limit',
  override: {
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      !controls?.server_pagination?.value,
  },
};

export const TimeSeriesLimitMetricControlSetItem: ControlSetItem = {
  name: 'timeseries_limit_metric',
  override: {
    visibility: isAggMode,
  },
};
