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
import { FC, useMemo } from 'react';
import { t, useTheme, styled } from '@apache-superset/core/ui';
import { Empty, Loading } from '@superset-ui/core/components';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import type { Resource } from 'src/hooks/apiResources/apiResources';
import type {
  DatasetLineage,
  ChartLineage,
  DashboardLineage,
  ChartEntity,
  DashboardEntity,
} from 'src/hooks/apiResources/lineage';
import Echart from '../../../plugins/plugin-chart-echarts/src/components/Echart';
import type { EChartsCoreOption } from 'echarts/core';

const LineageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
`;

const Legend = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: center;
    align-items: center;
    gap: ${theme.sizeUnit * 4}px;
    padding: ${theme.sizeUnit * 3}px;
    background-color: ${theme.colorBgLayout};
    border-bottom: 1px solid ${theme.colorBorder};
  `}
`;

const LegendItem = styled.div<{ color: string }>`
  ${({ theme, color }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorText};

    &::before {
      content: '';
      width: 12px;
      height: 12px;
      border-radius: 2px;
      background-color: ${color};
    }
  `}
`;

type LineageViewProps = {
  lineageResource:
    | Resource<DatasetLineage>
    | Resource<ChartLineage>
    | Resource<DashboardLineage>;
  entityType: 'dataset' | 'chart' | 'dashboard';
};

const LineageView: FC<LineageViewProps> = ({ lineageResource, entityType }) => {
  const theme = useTheme();

  const echartOptions: EChartsCoreOption | null = useMemo(() => {
    if (
      lineageResource.status !== ResourceStatus.Complete ||
      !lineageResource.result
    ) {
      return null;
    }

    const data = lineageResource.result;
    const nodes: {
      name: string;
      itemStyle?: { color: string };
      label?: { position?: string };
    }[] = [];
    const links: { source: string; target: string; value: number }[] = [];
    const nodeSet = new Set<string>();

    // Helper to add a node with label position
    const addNode = (
      name: string,
      color: string,
      labelPosition: 'left' | 'right' | 'inside',
    ) => {
      if (!nodeSet.has(name)) {
        nodeSet.add(name);
        nodes.push({
          name,
          itemStyle: { color },
          label: {
            position: labelPosition,
          },
        });
      }
    };

    // Helper to add a link
    const addLink = (source: string, target: string) => {
      links.push({ source, target, value: 1 });
    };

    // Build nodes and links based on entity type
    if (entityType === 'dataset' && 'dataset' in data) {
      const { dataset, upstream, downstream } = data as DatasetLineage;

      // Add current dataset node (center) - label inside
      addNode(dataset.name, theme.colorPrimary, 'inside');

      // Add upstream database - label on left
      if (upstream?.database) {
        addNode(upstream.database.database_name, theme.colorInfo, 'left');
        addLink(upstream.database.database_name, dataset.name);
      }

      // Add downstream charts - label on right
      const chartMap = new Map<number, ChartEntity>();
      if (downstream?.charts?.result) {
        downstream.charts.result.forEach((chart: ChartEntity) => {
          chartMap.set(chart.id, chart);
          addNode(chart.slice_name, theme.colorSuccess, 'right');
          addLink(dataset.name, chart.slice_name);
        });
      }

      // Add downstream dashboards - label on right
      if (downstream?.dashboards?.result) {
        downstream.dashboards.result.forEach((dashboard: DashboardEntity) => {
          addNode(dashboard.title, theme.colorWarning, 'right');

          // Link from charts to dashboards using chart_ids
          if (dashboard.chart_ids && dashboard.chart_ids.length > 0) {
            dashboard.chart_ids.forEach(chartId => {
              const chart = chartMap.get(chartId);
              if (chart) {
                addLink(chart.slice_name, dashboard.title);
              }
            });
          }
        });
      }
    } else if (entityType === 'chart' && 'chart' in data) {
      const { chart, upstream, downstream } = data as ChartLineage;

      // Add current chart node (center) - label inside
      addNode(chart.slice_name, theme.colorPrimary, 'inside');

      // Add upstream dataset - label on left
      if (upstream?.dataset) {
        addNode(upstream.dataset.name, theme.colorInfo, 'left');
        addLink(upstream.dataset.name, chart.slice_name);

        // Add upstream database - label on left
        if (upstream.database) {
          addNode(upstream.database.database_name, theme.colorWarning, 'left');
          addLink(upstream.database.database_name, upstream.dataset.name);
        }
      }

      // Add downstream dashboards - label on right
      if (downstream?.dashboards?.result) {
        downstream.dashboards.result.forEach((dashboard: DashboardEntity) => {
          addNode(dashboard.title, theme.colorSuccess, 'right');
          addLink(chart.slice_name, dashboard.title);
        });
      }
    } else if (entityType === 'dashboard' && 'dashboard' in data) {
      const { dashboard, upstream } = data as DashboardLineage;

      // Add current dashboard node (right) - label inside
      addNode(dashboard.title, theme.colorPrimary, 'inside');

      // Create a map of chart id to chart for easy lookup
      const chartMap = new Map<number, ChartEntity>();
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          chartMap.set(chart.id, chart);
          // Charts are upstream - label on left
          addNode(chart.slice_name, theme.colorInfo, 'left');
          addLink(chart.slice_name, dashboard.title);
        });
      }

      // Create a map of dataset id to dataset for easy lookup
      const datasetMap = new Map<number, any>();
      if (upstream?.datasets?.result) {
        upstream.datasets.result.forEach(dataset => {
          datasetMap.set(dataset.id, dataset);
          // Datasets are upstream - label on left
          addNode(dataset.name, theme.colorSuccess, 'left');

          // Link datasets to their specific charts using chart_ids
          if (dataset.chart_ids && dataset.chart_ids.length > 0) {
            dataset.chart_ids.forEach(chartId => {
              const chart = chartMap.get(chartId);
              if (chart) {
                addLink(dataset.name, chart.slice_name);
              }
            });
          }
        });
      }

      // Add upstream databases and link to their specific datasets
      if (upstream?.databases?.result) {
        upstream.databases.result.forEach(database => {
          // Databases are upstream - label on left
          addNode(database.database_name, theme.colorWarning, 'left');

          // Link databases to datasets that belong to them using database_id
          if (upstream.datasets?.result) {
            upstream.datasets.result.forEach(dataset => {
              if (dataset.database_id === database.id) {
                addLink(database.database_name, dataset.name);
              }
            });
          }
        });
      }
    }

    return {
      series: {
        animation: false,
        data: nodes,
        lineStyle: {
          color: 'source',
        },
        links,
        type: 'sankey',
      },
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
      },
    };
  }, [lineageResource, entityType, theme]);

  // Build legend data based on entity type
  const legendItems: { label: string; color: string }[] = useMemo(() => {
    if (entityType === 'dataset') {
      return [
        { label: 'Database (Upstream)', color: theme.colorInfo },
        { label: 'Dataset (Current)', color: theme.colorPrimary },
        { label: 'Chart (Downstream)', color: theme.colorSuccess },
        { label: 'Dashboard (Downstream)', color: theme.colorWarning },
      ];
    } else if (entityType === 'chart') {
      return [
        { label: 'Database (Upstream)', color: theme.colorWarning },
        { label: 'Dataset (Upstream)', color: theme.colorInfo },
        { label: 'Chart (Current)', color: theme.colorPrimary },
        { label: 'Dashboard (Downstream)', color: theme.colorSuccess },
      ];
    } else if (entityType === 'dashboard') {
      return [
        { label: 'Database (Upstream)', color: theme.colorWarning },
        { label: 'Dataset (Upstream)', color: theme.colorSuccess },
        { label: 'Chart (Upstream)', color: theme.colorInfo },
        { label: 'Dashboard (Current)', color: theme.colorPrimary },
      ];
    }
    return [];
  }, [entityType, theme]);

  if (lineageResource.status === ResourceStatus.Loading) {
    return <Loading />;
  }

  if (
    lineageResource.status === ResourceStatus.Error ||
    !lineageResource.result
  ) {
    return <Empty description={t('Failed to load lineage data')} />;
  }

  if (!echartOptions) {
    return <Empty description={t('No lineage data available')} />;
  }

  return (
    <LineageContainer>
      <Legend>
        {legendItems.map(item => (
          <LegendItem key={item.label} color={item.color}>
            {item.label}
          </LegendItem>
        ))}
      </Legend>
      <Echart
        refs={{}}
        height={600}
        width={800}
        echartOptions={echartOptions}
        vizType="sankey"
      />
    </LineageContainer>
  );
};

export default LineageView;
