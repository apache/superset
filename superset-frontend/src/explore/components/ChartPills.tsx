/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { forwardRef, RefObject } from 'react';
import { css, QueryData, SupersetTheme } from '@superset-ui/core';
import RowCountLabel from 'src/explore/components/RowCountLabel';
import CachedLabel from 'src/components/CachedLabel';
import Timer from 'src/components/Timer';
import { Type } from 'src/components/Label';

const CHART_STATUS_MAP = {
  failed: 'danger' as Type,
  loading: 'warning' as Type,
  success: 'success' as Type,
};

export type ChartPillsProps = {
  queriesResponse: QueryData[];
  chartStatus: keyof typeof CHART_STATUS_MAP;
  chartUpdateStartTime: number;
  chartUpdateEndTime: number;
  refreshCachedQuery: () => void;
  rowLimit: string | number;
};

export const ChartPills = forwardRef(
  (
    {
      queriesResponse,
      chartStatus,
      chartUpdateStartTime,
      chartUpdateEndTime,
      refreshCachedQuery,
      rowLimit,
    }: ChartPillsProps,
    ref: RefObject<HTMLDivElement>,
  ) => {
    const isLoading = chartStatus === 'loading';
    const firstQueryResponse = queriesResponse?.[0];
    return (
      <div ref={ref}>
        <div
          css={(theme: SupersetTheme) => css`
            display: flex;
            justify-content: flex-end;
            padding-bottom: ${theme.gridUnit * 4}px;
            & .ant-tag:last-of-type {
              margin: 0;
            }
          `}
        >
          {!isLoading && firstQueryResponse && (
            <RowCountLabel
              rowcount={Number(firstQueryResponse.sql_rowcount) || 0}
              limit={Number(rowLimit) || 0}
            />
          )}
          {!isLoading && firstQueryResponse?.is_cached && (
            <CachedLabel
              onClick={refreshCachedQuery}
              cachedTimestamp={firstQueryResponse.cached_dttm}
            />
          )}
          <Timer
            startTime={chartUpdateStartTime}
            endTime={chartUpdateEndTime}
            isRunning={isLoading}
            status={CHART_STATUS_MAP[chartStatus]}
          />
        </div>
      </div>
    );
  },
);
