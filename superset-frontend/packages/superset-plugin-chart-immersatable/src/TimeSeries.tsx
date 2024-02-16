import React, { memo, Suspense } from 'react';
import { ChartData } from './types';
import { CohortInlineTrackChart } from './InlineTrackChart';

export interface ITimeSeriesCellProps {
  value: string | number | null;
  chartData: ChartData;
}

export const TimeSeriesCell = memo(
  ({ value, chartData }: ITimeSeriesCellProps) => (
    <div className="flex space-x-3">
      {value !== null && value !== undefined ? (
        <span className="text-left">{value}</span>
      ) : null}

      {chartData ? (
        <div className="h-full w-full flex-1">
          <Suspense fallback={null}>
            <CohortInlineTrackChart data={chartData} width="160" />
          </Suspense>
        </div>
      ) : null}
    </div>
  ),
);
