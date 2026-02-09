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
import { FC, useMemo, useState, useCallback } from 'react';
import { t, useTheme, styled } from '@apache-superset/core/ui';
import { Empty, Loading } from '@superset-ui/core/components';
import { Button } from '@superset-ui/core/components';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import type { Resource } from 'src/hooks/apiResources/apiResources';
import type {
  DatasetLineage,
  ChartLineage,
  DashboardLineage,
  ChartEntity,
  DashboardEntity,
  DatasetEntity,
  DatabaseEntity,
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

const DetailsPanel = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 4}px;
    background-color: ${theme.colorBgLayout};
    border-top: 1px solid ${theme.colorBorder};
    min-height: 120px;
  `}
`;

const DetailsPanelHeader = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

const DetailsPanelActions = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const DetailsPanelTitle = styled.h4`
  ${({ theme }) => `
    margin: 0;
    font-size: ${theme.fontSizeLG}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

const DetailsPanelContent = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const DetailRow = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorText};
  `}
`;

const DetailLabel = styled.span`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    min-width: 100px;
  `}
`;

const DetailValue = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
  `}
`;

type NodeDetails = {
  name: string;
  type: 'database' | 'dataset' | 'chart' | 'dashboard';
  id?: number;
  additionalInfo?: Record<string, any>;
};

type LineageViewProps = {
  lineageResource:
    | Resource<DatasetLineage>
    | Resource<ChartLineage>
    | Resource<DashboardLineage>;
  entityType: 'dataset' | 'chart' | 'dashboard';
};

const LineageView: FC<LineageViewProps> = ({ lineageResource, entityType }) => {
  const theme = useTheme();
  const [selectedNode, setSelectedNode] = useState<NodeDetails | null>(null);

  // Create a mapping of node names to their details
  const nodeDetailsMap = useMemo(() => {
    if (
      lineageResource.status !== ResourceStatus.Complete ||
      !lineageResource.result
    ) {
      return new Map<string, NodeDetails>();
    }

    const data = lineageResource.result;
    const map = new Map<string, NodeDetails>();

    if (entityType === 'dataset' && 'dataset' in data) {
      const { dataset, upstream, downstream } = data as DatasetLineage;

      // Add current dataset
      map.set(dataset.name, {
        name: dataset.name,
        type: 'dataset',
        id: dataset.id,
        additionalInfo: {
          schema: dataset.schema,
          table_name: dataset.table_name,
          database_name: dataset.database_name,
        },
      });

      // Add upstream database
      if (upstream?.database) {
        map.set(upstream.database.database_name, {
          name: upstream.database.database_name,
          type: 'database',
          id: upstream.database.id,
        });
      }

      // Add downstream charts
      if (downstream?.charts?.result) {
        downstream.charts.result.forEach((chart: ChartEntity) => {
          map.set(chart.slice_name, {
            name: chart.slice_name,
            type: 'chart',
            id: chart.id,
            additionalInfo: {
              viz_type: chart.viz_type,
            },
          });
        });
      }

      // Add downstream dashboards
      if (downstream?.dashboards?.result) {
        downstream.dashboards.result.forEach((dashboard: DashboardEntity) => {
          map.set(dashboard.title, {
            name: dashboard.title,
            type: 'dashboard',
            id: dashboard.id,
            additionalInfo: {
              slug: dashboard.slug,
            },
          });
        });
      }
    } else if (entityType === 'chart' && 'chart' in data) {
      const { chart, upstream, downstream } = data as ChartLineage;

      // Add current chart
      map.set(chart.slice_name, {
        name: chart.slice_name,
        type: 'chart',
        id: chart.id,
        additionalInfo: {
          viz_type: chart.viz_type,
        },
      });

      // Add upstream dataset
      if (upstream?.dataset) {
        map.set(upstream.dataset.name, {
          name: upstream.dataset.name,
          type: 'dataset',
          id: upstream.dataset.id,
          additionalInfo: {
            schema: upstream.dataset.schema,
            table_name: upstream.dataset.table_name,
          },
        });
      }

      // Add upstream database
      if (upstream?.database) {
        map.set(upstream.database.database_name, {
          name: upstream.database.database_name,
          type: 'database',
          id: upstream.database.id,
        });
      }

      // Add downstream dashboards
      if (downstream?.dashboards?.result) {
        downstream.dashboards.result.forEach((dashboard: DashboardEntity) => {
          map.set(dashboard.title, {
            name: dashboard.title,
            type: 'dashboard',
            id: dashboard.id,
            additionalInfo: {
              slug: dashboard.slug,
            },
          });
        });
      }
    } else if (entityType === 'dashboard' && 'dashboard' in data) {
      const { dashboard, upstream } = data as DashboardLineage;

      // Add current dashboard
      map.set(dashboard.title, {
        name: dashboard.title,
        type: 'dashboard',
        id: dashboard.id,
        additionalInfo: {
          slug: dashboard.slug,
        },
      });

      // First pass: detect duplicate chart names
      const chartNameCounts = new Map<string, number>();
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          const count = chartNameCounts.get(chart.slice_name) || 0;
          chartNameCounts.set(chart.slice_name, count + 1);
        });
      }

      // Add upstream charts
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          // Only append ID if there are duplicate names
          const hasDuplicate = (chartNameCounts.get(chart.slice_name) || 0) > 1;
          const chartNodeName = hasDuplicate
            ? `${chart.slice_name} (#${chart.id})`
            : chart.slice_name;
          map.set(chartNodeName, {
            name: chart.slice_name,
            type: 'chart',
            id: chart.id,
            additionalInfo: {
              viz_type: chart.viz_type,
            },
          });
        });
      }

      // Add upstream datasets
      if (upstream?.datasets?.result) {
        upstream.datasets.result.forEach((dataset: DatasetEntity) => {
          map.set(dataset.name, {
            name: dataset.name,
            type: 'dataset',
            id: dataset.id,
            additionalInfo: {
              schema: dataset.schema,
              table_name: dataset.table_name,
            },
          });
        });
      }

      // Add upstream databases
      if (upstream?.databases?.result) {
        upstream.databases.result.forEach((database: DatabaseEntity) => {
          map.set(database.database_name, {
            name: database.database_name,
            type: 'database',
            id: database.id,
          });
        });
      }
    }

    return map;
  }, [lineageResource, entityType]);

  // Handle node click
  const handleNodeClick = useCallback((params: any) => {
    if (params.dataType === 'node') {
      const nodeName = params.name;
      const nodeDetails = nodeDetailsMap.get(nodeName);
      if (nodeDetails) {
        setSelectedNode(nodeDetails);
      }
    }
    // Always stop event propagation to prevent tooltip issues
    if (params.event) {
      params.event.stop();
    }
  }, [nodeDetailsMap]);

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

      // First pass: detect duplicate chart names
      const chartNameCounts = new Map<string, number>();
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          const count = chartNameCounts.get(chart.slice_name) || 0;
          chartNameCounts.set(chart.slice_name, count + 1);
        });
      }

      // Create a map of chart id to chart for easy lookup
      const chartMap = new Map<number, ChartEntity>();
      const chartNodeNames = new Map<number, string>(); // Map chart ID to its node name
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          chartMap.set(chart.id, chart);
          // Only append ID if there are duplicate names
          const hasDuplicate = (chartNameCounts.get(chart.slice_name) || 0) > 1;
          const chartNodeName = hasDuplicate
            ? `${chart.slice_name} (#${chart.id})`
            : chart.slice_name;
          chartNodeNames.set(chart.id, chartNodeName);
          // Charts are upstream - label on left
          addNode(chartNodeName, theme.colorInfo, 'left');
          addLink(chartNodeName, dashboard.title);
        });
      }

      // Create a map of dataset id to dataset for easy lookup
      const datasetMap = new Map<number, any>();
      if (upstream?.datasets?.result) {
        upstream.datasets.result.forEach(dataset => {
          datasetMap.set(dataset.id, dataset);
          // Datasets are upstream - label on left
          addNode(dataset.name, theme.colorSuccess, 'left');
        });
      }

      // Link charts to their specific datasets using dataset_id from each chart
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          if (chart.dataset_id) {
            const dataset = datasetMap.get(chart.dataset_id);
            const chartNodeName = chartNodeNames.get(chart.id);
            if (dataset && chartNodeName) {
              addLink(dataset.name, chartNodeName);
            }
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
        show: false,
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

  // Helper function to get the URL for an entity
  const getEntityUrl = (nodeDetails: NodeDetails): string => {
    switch (nodeDetails.type) {
      case 'dashboard':
        return `/superset/dashboard/${nodeDetails.id}/`;
      case 'chart':
        return `/explore/?slice_id=${nodeDetails.id}`;
      case 'dataset':
        return `/dataset/${nodeDetails.id}`;
      default:
        return '#';
    }
  };

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
        height={selectedNode ? 450 : 600}
        width={800}
        echartOptions={echartOptions}
        vizType="sankey"
        eventHandlers={{
          click: handleNodeClick,
        }}
      />
      {selectedNode && (
        <DetailsPanel>
          <DetailsPanelHeader>
            <DetailsPanelTitle>
              {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)} Details
            </DetailsPanelTitle>
            <DetailsPanelActions>
              {(selectedNode.type === 'dashboard' || selectedNode.type === 'chart') && (
                <Button
                  buttonStyle="primary"
                  buttonSize="small"
                  onClick={() => {
                    window.location.href = getEntityUrl(selectedNode);
                  }}
                >
                  {t('Open')} {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
                </Button>
              )}
              <Button
                buttonStyle="tertiary"
                buttonSize="small"
                onClick={() => setSelectedNode(null)}
              >
                {t('Close')}
              </Button>
            </DetailsPanelActions>
          </DetailsPanelHeader>
          <DetailsPanelContent>
            <DetailRow>
              <DetailLabel>{t('Name')}:</DetailLabel>
              <DetailValue>{selectedNode.name}</DetailValue>
            </DetailRow>
            {selectedNode.id && (
              <DetailRow>
                <DetailLabel>{t('ID')}:</DetailLabel>
                <DetailValue>{selectedNode.id}</DetailValue>
              </DetailRow>
            )}
            {selectedNode.additionalInfo &&
              Object.entries(selectedNode.additionalInfo).map(([key, value]) => (
                <DetailRow key={key}>
                  <DetailLabel>
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:
                  </DetailLabel>
                  <DetailValue>{String(value)}</DetailValue>
                </DetailRow>
              ))}
          </DetailsPanelContent>
        </DetailsPanel>
      )}
    </LineageContainer>
  );
};

export default LineageView;
