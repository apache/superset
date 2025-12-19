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
import { Link } from 'react-router-dom';
import { t, SupersetClient } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/ui';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';

import {
  ConfirmStatusChange,
  DeleteModal,
  Empty,
  Skeleton,
} from '@superset-ui/core/components';
import {
  ListView,
  ListViewActionsBar,
  type ListViewProps,
  type ListViewActionProps,
} from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';

import {
  fetchAllSimulations,
  deleteSimulation,
  WhatIfSimulation,
} from 'src/dashboard/components/WhatIfDrawer/whatIfApi';

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
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const EmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.gridUnit * 16}px;
`;

function WhatIfSimulationList({
  addDangerToast,
  addSuccessToast,
}: WhatIfSimulationListProps) {
  const [simulations, setSimulations] = useState<WhatIfSimulation[]>([]);
  const [dashboards, setDashboards] = useState<Record<number, DashboardInfo>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [simulationCurrentlyDeleting, setSimulationCurrentlyDeleting] =
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
    name: t('What-If Simulations'),
  };

  const initialSort = [{ id: 'changedOn', desc: true }];

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        size: 'xxl',
        id: 'name',
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
        size: 'lg',
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
        size: 'md',
        id: 'modifications',
        disableSortBy: true,
        Cell: ({
          row: {
            original: { modifications },
          },
        }: {
          row: { original: WhatIfSimulation };
        }) => modifications.length,
      },
      {
        accessor: 'changedOn',
        Header: t('Last modified'),
        size: 'lg',
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

          const handleOpen = () => {
            window.location.href = dashboardUrl;
          };
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
        disableSortBy: true,
      },
    ],
    [dashboards],
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
