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
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
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

type NodeType = 'database' | 'dataset' | 'chart' | 'dashboard';

type NodeDetails = {
  name: string;
  type: NodeType;
  id?: number;
  additionalInfo?: Record<string, any>;
};

// Build a stable, unique graph identity for a node so that entities sharing the
// same display name (e.g. two charts with identical titles) never collapse into
// a single Sankey node. The human-readable name is kept separately as the label.
const nodeKey = (type: NodeType, id?: number, name?: string): string =>
  id != null ? `${type}:${id}` : `${type}:${name ?? ''}`;

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
      map.set(nodeKey('dataset', dataset.id, dataset.name), {
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
        map.set(
          nodeKey(
            'database',
            upstream.database.id,
            upstream.database.database_name,
          ),
          {
            name: upstream.database.database_name,
            type: 'database',
            id: upstream.database.id,
          },
        );
      }

      // Add downstream charts
      if (downstream?.charts?.result) {
        downstream.charts.result.forEach((chart: ChartEntity) => {
          map.set(nodeKey('chart', chart.id, chart.slice_name), {
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
          map.set(nodeKey('dashboard', dashboard.id, dashboard.title), {
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
      map.set(nodeKey('chart', chart.id, chart.slice_name), {
        name: chart.slice_name,
        type: 'chart',
        id: chart.id,
        additionalInfo: {
          viz_type: chart.viz_type,
        },
      });

      // Add upstream dataset
      if (upstream?.dataset) {
        map.set(
          nodeKey('dataset', upstream.dataset.id, upstream.dataset.name),
          {
            name: upstream.dataset.name,
            type: 'dataset',
            id: upstream.dataset.id,
            additionalInfo: {
              schema: upstream.dataset.schema,
              table_name: upstream.dataset.table_name,
            },
          },
        );
      }

      // Add upstream database
      if (upstream?.database) {
        map.set(
          nodeKey(
            'database',
            upstream.database.id,
            upstream.database.database_name,
          ),
          {
            name: upstream.database.database_name,
            type: 'database',
            id: upstream.database.id,
          },
        );
      }

      // Add downstream dashboards
      if (downstream?.dashboards?.result) {
        downstream.dashboards.result.forEach((dashboard: DashboardEntity) => {
          map.set(nodeKey('dashboard', dashboard.id, dashboard.title), {
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
      map.set(nodeKey('dashboard', dashboard.id, dashboard.title), {
        name: dashboard.title,
        type: 'dashboard',
        id: dashboard.id,
        additionalInfo: {
          slug: dashboard.slug,
        },
      });

      // Add upstream charts
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          map.set(nodeKey('chart', chart.id, chart.slice_name), {
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
          map.set(nodeKey('dataset', dataset.id, dataset.name), {
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
          map.set(nodeKey('database', database.id, database.database_name), {
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
  const handleNodeClick = useCallback(
    (params: any) => {
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
    },
    [nodeDetailsMap],
  );

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
      label?: { position?: string; formatter?: string };
      itemStyle?: { color: string };
    }[] = [];
    const links: { source: string; target: string; value: number }[] = [];
    const nodeSet = new Set<string>();

    // Helper to add a node. `key` is the stable unique identity used for graph
    // links and detail lookups; `label` is the human-readable text shown.
    const addNode = (
      key: string,
      label: string,
      color: string,
      labelPosition: 'left' | 'right' | 'inside',
    ) => {
      if (!nodeSet.has(key)) {
        nodeSet.add(key);
        nodes.push({
          name: key,
          itemStyle: { color },
          label: {
            position: labelPosition,
            formatter: label,
          },
        });
      }
    };

    // Helper to add a link between two node keys
    const addLink = (source: string, target: string) => {
      links.push({ source, target, value: 1 });
    };

    // Build nodes and links based on entity type
    if (entityType === 'dataset' && 'dataset' in data) {
      const { dataset, upstream, downstream } = data as DatasetLineage;

      const datasetKey = nodeKey('dataset', dataset.id, dataset.name);
      // Add current dataset node (center) - label inside
      addNode(datasetKey, dataset.name, theme.colorPrimary, 'inside');

      // Add upstream database - label on left
      if (upstream?.database) {
        const dbKey = nodeKey(
          'database',
          upstream.database.id,
          upstream.database.database_name,
        );
        addNode(
          dbKey,
          upstream.database.database_name,
          theme.colorInfo,
          'left',
        );
        addLink(dbKey, datasetKey);
      }

      // Add downstream charts - label on right
      const chartKeys = new Map<number, string>();
      if (downstream?.charts?.result) {
        downstream.charts.result.forEach((chart: ChartEntity) => {
          const chartKey = nodeKey('chart', chart.id, chart.slice_name);
          chartKeys.set(chart.id, chartKey);
          addNode(chartKey, chart.slice_name, theme.colorSuccess, 'right');
          addLink(datasetKey, chartKey);
        });
      }

      // Add downstream dashboards - label on right
      if (downstream?.dashboards?.result) {
        downstream.dashboards.result.forEach((dashboard: DashboardEntity) => {
          const dashKey = nodeKey('dashboard', dashboard.id, dashboard.title);
          addNode(dashKey, dashboard.title, theme.colorWarning, 'right');

          // Link from charts to dashboards using chart_ids
          if (dashboard.chart_ids && dashboard.chart_ids.length > 0) {
            dashboard.chart_ids.forEach(chartId => {
              const chartKey = chartKeys.get(chartId);
              if (chartKey) {
                addLink(chartKey, dashKey);
              }
            });
          }
        });
      }
    } else if (entityType === 'chart' && 'chart' in data) {
      const { chart, upstream, downstream } = data as ChartLineage;

      const chartKey = nodeKey('chart', chart.id, chart.slice_name);
      // Add current chart node (center) - label inside
      addNode(chartKey, chart.slice_name, theme.colorPrimary, 'inside');

      // Add upstream dataset - label on left
      if (upstream?.dataset) {
        const datasetKey = nodeKey(
          'dataset',
          upstream.dataset.id,
          upstream.dataset.name,
        );
        addNode(datasetKey, upstream.dataset.name, theme.colorInfo, 'left');
        addLink(datasetKey, chartKey);

        // Add upstream database - label on left
        if (upstream.database) {
          const dbKey = nodeKey(
            'database',
            upstream.database.id,
            upstream.database.database_name,
          );
          addNode(
            dbKey,
            upstream.database.database_name,
            theme.colorWarning,
            'left',
          );
          addLink(dbKey, datasetKey);
        }
      }

      // Add downstream dashboards - label on right
      if (downstream?.dashboards?.result) {
        downstream.dashboards.result.forEach((dashboard: DashboardEntity) => {
          const dashKey = nodeKey('dashboard', dashboard.id, dashboard.title);
          addNode(dashKey, dashboard.title, theme.colorSuccess, 'right');
          addLink(chartKey, dashKey);
        });
      }
    } else if (entityType === 'dashboard' && 'dashboard' in data) {
      const { dashboard, upstream } = data as DashboardLineage;

      const dashKey = nodeKey('dashboard', dashboard.id, dashboard.title);
      // Add current dashboard node (right) - label inside
      addNode(dashKey, dashboard.title, theme.colorPrimary, 'inside');

      // Add upstream charts - label on left
      const chartKeys = new Map<number, string>();
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          const chartKey = nodeKey('chart', chart.id, chart.slice_name);
          chartKeys.set(chart.id, chartKey);
          addNode(chartKey, chart.slice_name, theme.colorInfo, 'left');
          addLink(chartKey, dashKey);
        });
      }

      // Add upstream datasets - label on left
      const datasetKeys = new Map<number, string>();
      if (upstream?.datasets?.result) {
        upstream.datasets.result.forEach(dataset => {
          const datasetKey = nodeKey('dataset', dataset.id, dataset.name);
          datasetKeys.set(dataset.id, datasetKey);
          addNode(datasetKey, dataset.name, theme.colorSuccess, 'left');
        });
      }

      // Link charts to their specific datasets using dataset_id from each chart
      if (upstream?.charts?.result) {
        upstream.charts.result.forEach((chart: ChartEntity) => {
          if (chart.dataset_id) {
            const datasetKey = datasetKeys.get(chart.dataset_id);
            const chartKey = chartKeys.get(chart.id);
            if (datasetKey && chartKey) {
              addLink(datasetKey, chartKey);
            }
          }
        });
      }

      // Add upstream databases and link to their specific datasets
      if (upstream?.databases?.result) {
        upstream.databases.result.forEach(database => {
          const dbKey = nodeKey(
            'database',
            database.id,
            database.database_name,
          );
          addNode(dbKey, database.database_name, theme.colorWarning, 'left');

          // Link databases to datasets that belong to them using database_id
          if (upstream.datasets?.result) {
            upstream.datasets.result.forEach(dataset => {
              if (dataset.database_id === database.id) {
                const datasetKey = datasetKeys.get(dataset.id);
                if (datasetKey) {
                  addLink(dbKey, datasetKey);
                }
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
              {t(
                '%s Details',
                selectedNode.type.charAt(0).toUpperCase() +
                  selectedNode.type.slice(1),
              )}
            </DetailsPanelTitle>
            <DetailsPanelActions>
              {(selectedNode.type === 'dashboard' ||
                selectedNode.type === 'chart') && (
                <Button
                  buttonStyle="primary"
                  buttonSize="small"
                  onClick={() => {
                    window.location.href = getEntityUrl(selectedNode);
                  }}
                >
                  {t('Open')}{' '}
                  {selectedNode.type.charAt(0).toUpperCase() +
                    selectedNode.type.slice(1)}
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
              Object.entries(selectedNode.additionalInfo).map(
                ([key, value]) => (
                  <DetailRow key={key}>
                    <DetailLabel>
                      {key.charAt(0).toUpperCase() +
                        key.slice(1).replace(/_/g, ' ')}
                      :
                    </DetailLabel>
                    <DetailValue>{String(value)}</DetailValue>
                  </DetailRow>
                ),
              )}
          </DetailsPanelContent>
        </DetailsPanel>
      )}
    </LineageContainer>
  );
};

export default LineageView;
