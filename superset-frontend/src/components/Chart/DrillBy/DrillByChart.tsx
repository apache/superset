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
import React, { useMemo } from 'react';
import {
  BinaryQueryObjectFilterClause,
  Column,
  css,
  useTheme,
} from '@superset-ui/core';
import ChartContainer from 'src/components/Chart/ChartContainer';
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';

interface DrillByChartProps {
  column?: Column;
  filters?: BinaryQueryObjectFilterClause[];
  formData: { [key: string]: any; viz_type: string };
  groupbyFieldName?: string;
}

export default function DrillByChart({
  column,
  filters,
  formData,
  groupbyFieldName,
}: DrillByChartProps) {
  let updatedFormData = formData;
  const theme = useTheme();
  // chartId needs to be randomized because data doesn't change
  // if id stay the same
  const chartId = useMemo(() => Math.floor(Math.random() * 1000), []);
  const chart = useSelector<RootState, any>(state => state.charts[chartId]);
  if (filters) {
    updatedFormData = {
      ...formData,
      adhoc_filters: [
        ...formData.adhoc_filters,
        {
          clause: 'WHERE',
          comparator: filters[0].val,
          expressionType: 'SIMPLE',
          operator: filters[0].op,
          subject: filters[0].col,
        },
      ],
      [groupbyFieldName || 'groupby']: column ? [column.column_name] : [],
    };
  }

  return (
    <div
      css={css`
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      `}
    >
      <ChartContainer
        chartId={chartId}
        chartStatus={chart ? chart.chartStatus : 'loading'}
        force
        formData={updatedFormData}
        queriesResponse={chart?.queriesResponse}
        triggerQuery={chart ? chart.triggerQuery : true}
        vizType={formData.viz_type}
        width={theme.gridUnit * 80}
        height={theme.gridUnit * 80}
      />
    </div>
  );
}
