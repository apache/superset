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
import { useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled, css } from '@apache-superset/core/theme';
import { Empty, Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

export interface ChartEntity {
  id: number;
  slice_name: string;
  form_data?: { viz_type?: string };
}

interface DashboardChartsProps {
  dashboardId: number;
  charts: ChartEntity[];
  loading: boolean;
  /** Ask the parent to lazily load this dashboard's charts. */
  onRequest: (dashboardId: number) => void;
}

/**
 * Read-only preview of the charts that make up a dashboard. This is purely
 * informational — the charts are not navigable from here (by design).
 */
const ChartList = styled.ul`
  ${({ theme }) => css`
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 240px;
    overflow-y: auto;

    li {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit}px;
      color: ${theme.colorText};
      font-size: ${theme.fontSize}px;
    }

    li + li {
      border-top: 1px solid ${theme.colorBorderSecondary};
    }

    .viz-type {
      margin-left: auto;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

export default function DashboardCharts({
  dashboardId,
  charts,
  loading,
  onRequest,
}: DashboardChartsProps) {
  useEffect(() => {
    onRequest(dashboardId);
  }, [dashboardId, onRequest]);

  if (loading) {
    return <Loading />;
  }

  if (charts.length === 0) {
    return <Empty description={t('This dashboard has no charts')} />;
  }

  return (
    <ChartList>
      {charts.map(chart => (
        <li key={chart.id}>
          <Icons.AreaChartOutlined iconSize="m" aria-hidden />
          <span>{chart.slice_name}</span>
          {chart.form_data?.viz_type && (
            <span className="viz-type">{chart.form_data.viz_type}</span>
          )}
        </li>
      ))}
    </ChartList>
  );
}
