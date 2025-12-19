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

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { t, SupersetClient } from '@superset-ui/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';

import {
  ConfirmStatusChange,
  DeleteModal,
  Empty,
  Skeleton,
  Tag,
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  ListView,
  ListViewActionsBar,
  type ListViewProps,
  type ListViewActionProps,
} from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { WhatIfFilter, WhatIfModification } from 'src/dashboard/types';
import { formatPercentageChange } from 'src/dashboard/util/whatIf';

import {
  fetchAllSimulations,
  deleteSimulation,
  WhatIfSimulation,
} from 'src/dashboard/components/WhatIfDrawer/whatIfApi';
import EditSimulationModal from './EditSimulationModal';

const PAGE_SIZE = 25;

interface WhatIfSimulationListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

interface DashboardInfo {
  id: number;
  dashboard_title: string;
  slug: string | null;
}

const PageContainer = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const EmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.sizeUnit * 16}px;
`;

const ModificationsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const ModificationTagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const FilterBadge = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colorTextSecondary};
  margin-left: ${({ theme }) => theme.sizeUnit}px;
`;

/**
 * Format a WhatIfFilter for display
 */
function formatFilterLabel(filter: WhatIfFilter): string {
  const { col, op, val } = filter;

  let valStr: string;
  if (Array.isArray(val)) {
    valStr = val.join(', ');
  } else if (typeof val === 'boolean') {
    valStr = val ? 'true' : 'false';
  } else {
    valStr = String(val);
  }
  // Truncate long values
  if (valStr.length > 15) {
    valStr = `${valStr.substring(0, 12)}...`;
  }
  return `${col} ${op} ${valStr}`;
}

/**
 * Component to render a single modification with its filters
 */
function ModificationTag({
  modification,
}: {
  modification: WhatIfModification;
}) {
  const theme = useTheme();
  const hasFilters = modification.filters && modification.filters.length > 0;

  const tagContent = (
    <Tag
      css={css`
        display: inline-flex;
        align-items: center;
        gap: ${theme.sizeUnit}px;
        margin: 0;
      `}
    >
      <span>{modification.column}</span>
      <span
        css={css`
          font-weight: ${theme.fontWeightStrong};
          color: ${modification.multiplier >= 1
            ? theme.colorSuccess
            : theme.colorError};
        `}
      >
        {formatPercentageChange(modification.multiplier, 0)}
      </span>
      {hasFilters && (
        <FilterBadge>
          <Icons.FilterOutlined iconSize="xs" />
        </FilterBadge>
      )}
    </Tag>
  );

  if (hasFilters) {
    const filterTooltip = modification
      .filters!.map(f => formatFilterLabel(f))
      .join(', ');
    return <Tooltip title={filterTooltip}>{tagContent}</Tooltip>;
  }

  return tagContent;
}

function WhatIfSimulationList({
  addDangerToast,
  addSuccessToast,
}: WhatIfSimulationListProps) {
  const history = useHistory();
  const [simulations, setSimulations] = useState<WhatIfSimulation[]>([]);
  const [dashboards, setDashboards] = useState<Record<number, DashboardInfo>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [simulationCurrentlyDeleting, setSimulationCurrentlyDeleting] =
    useState<WhatIfSimulation | null>(null);
  const [simulationCurrentlyEditing, setSimulationCurrentlyEditing] =
    useState<WhatIfSimulation | null>(null);

  const loadSimulations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAllSimulations();
      setSimulations(result);

      // Fetch dashboard info for all unique dashboard IDs
      const dashboardIds = [...new Set(result.map(sim => sim.dashboardId))];
      if (dashboardIds.length > 0) {
        const dashboardInfos: Record<number, DashboardInfo> = {};
        await Promise.all(
          dashboardIds.map(async id => {
            try {
              const response = await SupersetClient.get({
                endpoint: `/api/v1/dashboard/${id}`,
              });
              dashboardInfos[id] = {
                id,
                dashboard_title: response.json.result.dashboard_title,
                slug: response.json.result.slug,
              };
            } catch {
              dashboardInfos[id] = {
                id,
                dashboard_title: `Dashboard ${id}`,
                slug: null,
              };
            }
          }),
        );
        setDashboards(dashboardInfos);
      }
    } catch (error) {
      addDangerToast(t('Failed to load simulations'));
    } finally {
      setLoading(false);
    }
  }, [addDangerToast]);

  useEffect(() => {
    loadSimulations();
  }, [loadSimulations]);

  const handleDelete = useCallback(
    async (simulation: WhatIfSimulation) => {
      try {
        await deleteSimulation(simulation.id);
        setSimulationCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', simulation.name));
        loadSimulations();
      } catch (error) {
        addDangerToast(t('Failed to delete simulation'));
      }
    },
    [addSuccessToast, addDangerToast, loadSimulations],
  );

  const handleBulkDelete = useCallback(
    async (simulationsToDelete: WhatIfSimulation[]) => {
      try {
        await Promise.all(
          simulationsToDelete.map(sim => deleteSimulation(sim.id)),
        );
        addSuccessToast(
          t('Deleted %s simulation(s)', simulationsToDelete.length),
        );
        loadSimulations();
      } catch (error) {
        addDangerToast(t('Failed to delete simulations'));
      }
    },
    [addSuccessToast, addDangerToast, loadSimulations],
  );

  const menuData: SubMenuProps = {
    name: t('What-if simulations'),
  };

  const initialSort = [{ id: 'changedOn', desc: true }];

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        size: 'lg',
        id: 'name',
        Cell: ({
          row: {
            original: { id, name, dashboardId },
          },
        }: {
          row: { original: WhatIfSimulation };
        }) => {
          const dashboard = dashboards[dashboardId];
          const dashboardUrl = dashboard?.slug
            ? `/superset/dashboard/${dashboard.slug}/`
            : `/superset/dashboard/${dashboardId}/`;
          const url = `${dashboardUrl}?simulation=${id}`;
          return <Link to={url}>{name}</Link>;
        },
      },
      {
        accessor: 'description',
        Header: t('Description'),
        size: 'xl',
        id: 'description',
        Cell: ({
          row: {
            original: { description },
          },
        }: {
          row: { original: WhatIfSimulation };
        }) => description || '-',
      },
      {
        accessor: 'dashboardId',
        Header: t('Dashboard'),
        size: 'md',
        id: 'dashboardId',
        Cell: ({
          row: {
            original: { dashboardId },
          },
        }: {
          row: { original: WhatIfSimulation };
        }) => {
          const dashboard = dashboards[dashboardId];
          if (!dashboard) return `Dashboard ${dashboardId}`;
          const url = dashboard.slug
            ? `/superset/dashboard/${dashboard.slug}/`
            : `/superset/dashboard/${dashboardId}/`;
          return <Link to={url}>{dashboard.dashboard_title}</Link>;
        },
      },
      {
        accessor: 'modifications',
        Header: t('Modifications'),
        size: 'xxl',
        id: 'modifications',
        disableSortBy: true,
        Cell: ({
          row: {
            original: { modifications },
          },
        }: {
          row: { original: WhatIfSimulation };
        }) => {
          if (modifications.length === 0) {
            return <span>-</span>;
          }
          return (
            <ModificationsContainer>
              <ModificationTagsRow>
                {modifications.map((mod, idx) => (
                  <ModificationTag
                    key={`${mod.column}-${idx}`}
                    modification={mod}
                  />
                ))}
              </ModificationTagsRow>
            </ModificationsContainer>
          );
        },
      },
      {
        accessor: 'changedOn',
        Header: t('Last modified'),
        size: 'md',
        id: 'changedOn',
        Cell: ({
          row: {
            original: { changedOn },
          },
        }: {
          row: { original: WhatIfSimulation };
        }) => (changedOn ? dayjs(changedOn).format('ll') : '-'),
      },
      {
        Cell: ({
          row: { original },
        }: {
          row: { original: WhatIfSimulation };
        }) => {
          const dashboard = dashboards[original.dashboardId];
          const dashboardUrl = dashboard?.slug
            ? `/superset/dashboard/${dashboard.slug}/`
            : `/superset/dashboard/${original.dashboardId}/`;
          const simulationUrl = `${dashboardUrl}?simulation=${original.id}`;

          const handleOpen = () => {
            history.push(simulationUrl);
          };
          const handleEdit = () => setSimulationCurrentlyEditing(original);
          const handleDelete = () => setSimulationCurrentlyDeleting(original);

          const actions = [
            {
              label: 'open-action',
              tooltip: t('Open in Dashboard'),
              placement: 'bottom',
              icon: 'ExportOutlined',
              onClick: handleOpen,
            },
            {
              label: 'edit-action',
              tooltip: t('Edit modifications'),
              placement: 'bottom',
              icon: 'EditOutlined',
              onClick: handleEdit,
            },
            {
              label: 'delete-action',
              tooltip: t('Delete simulation'),
              placement: 'bottom',
              icon: 'DeleteOutlined',
              onClick: handleDelete,
            },
          ];

          return (
            <ListViewActionsBar actions={actions as ListViewActionProps[]} />
          );
        },
        Header: t('Actions'),
        id: 'actions',
        size: 'sm',
        disableSortBy: true,
      },
    ],
    [dashboards, history],
  );

  const emptyState = {
    title: t('No simulations yet'),
    image: 'filter-results.svg',
    description: t(
      'Create your first What-If simulation from the What-If panel in a dashboard.',
    ),
  };

  if (loading) {
    return (
      <>
        <SubMenu {...menuData} />
        <PageContainer>
          <Skeleton active />
        </PageContainer>
      </>
    );
  }

  if (simulations.length === 0) {
    return (
      <>
        <SubMenu {...menuData} />
        <EmptyContainer>
          <Empty
            image="simple"
            description={
              <>
                <div
                  css={css`
                    font-weight: 600;
                    margin-bottom: 8px;
                  `}
                >
                  {t('No simulations yet')}
                </div>
                <div>
                  {t(
                    'Create your first What-If simulation from the What-If panel in a dashboard.',
                  )}
                </div>
              </>
            }
          />
        </EmptyContainer>
      </>
    );
  }

  return (
    <>
      <SubMenu {...menuData} />
      {simulationCurrentlyDeleting && (
        <DeleteModal
          description={t(
            'Are you sure you want to delete %s?',
            simulationCurrentlyDeleting.name,
          )}
          onConfirm={() => {
            if (simulationCurrentlyDeleting) {
              handleDelete(simulationCurrentlyDeleting);
            }
          }}
          onHide={() => setSimulationCurrentlyDeleting(null)}
          open
          title={t('Delete Simulation?')}
        />
      )}
      {simulationCurrentlyEditing && (
        <EditSimulationModal
          simulation={simulationCurrentlyEditing}
          onHide={() => setSimulationCurrentlyEditing(null)}
          onSaved={loadSimulations}
          addSuccessToast={addSuccessToast}
          addDangerToast={addDangerToast}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected simulations?',
        )}
        onConfirm={handleBulkDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [
            {
              key: 'delete',
              name: t('Delete'),
              onSelect: confirmDelete,
              type: 'danger',
            },
          ];

          return (
            <ListView<WhatIfSimulation>
              bulkActions={bulkActions}
              bulkSelectEnabled={false}
              columns={columns}
              count={simulations.length}
              data={simulations}
              emptyState={emptyState}
              fetchData={() => {}}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              refreshData={loadSimulations}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(WhatIfSimulationList);
