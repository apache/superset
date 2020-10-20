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
import { SupersetClient, t } from '@superset-ui/core';
import React, { useState, useMemo } from 'react';
import rison from 'rison';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import { useListViewResource, useFavoriteStatus } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import FacePile from 'src/components/FacePile';
import ListView, { ListViewProps, Filters } from 'src/components/ListView';
import Owner from 'src/types/Owner';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import Icon from 'src/components/Icon';
import Label from 'src/components/Label';
import FaveStar from 'src/components/FaveStar';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import ListViewCard from 'src/components/ListViewCard';
import { Dropdown, Menu } from 'src/common/components';
import TooltipWrapper from 'src/components/TooltipWrapper';

const PAGE_SIZE = 25;
const FAVESTAR_BASE_URL = '/superset/favstar/Dashboard';

interface DashboardListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

interface Dashboard {
  changed_by_name: string;
  changed_by_url: string;
  changed_on_delta_humanized: string;
  changed_by: string;
  dashboard_title: string;
  id: number;
  published: boolean;
  url: string;
  thumbnail_url: string;
  owners: Owner[];
  created_by: object;
}

function DashboardList(props: DashboardListProps) {
  const {
    state: {
      loading,
      resourceCount: dashboardCount,
      resourceCollection: dashboards,
      bulkSelectEnabled,
    },
    setResourceCollection: setDashboards,
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<Dashboard>(
    'dashboard',
    t('dashboard'),
    props.addDangerToast,
  );
  const [favoriteStatusRef, fetchFaveStar, saveFaveStar] = useFavoriteStatus(
    {},
    FAVESTAR_BASE_URL,
    props.addDangerToast,
  );

  const [dashboardToEdit, setDashboardToEdit] = useState<Dashboard | null>(
    null,
  );

  const canCreate = hasPerm('can_add');
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');
  const canExport = hasPerm('can_mulexport');

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  function openDashboardEditModal(dashboard: Dashboard) {
    setDashboardToEdit(dashboard);
  }

  function handleDashboardEdit(edits: Dashboard) {
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/${edits.id}`,
    }).then(
      ({ json = {} }) => {
        setDashboards(
          dashboards.map(dashboard => {
            if (dashboard.id === json.id) {
              return json.result;
            }
            return dashboard;
          }),
        );
      },
      createErrorHandler(errMsg =>
        props.addDangerToast(
          t('An error occurred while fetching dashboards: %s', errMsg),
        ),
      ),
    );
  }

  function handleDashboardDelete({
    id,
    dashboard_title: dashboardTitle,
  }: Dashboard) {
    return SupersetClient.delete({
      endpoint: `/api/v1/dashboard/${id}`,
    }).then(
      () => {
        refreshData();
        props.addSuccessToast(t('Deleted: %s', dashboardTitle));
      },
      createErrorHandler(errMsg =>
        props.addDangerToast(
          t('There was an issue deleting %s: %s', dashboardTitle, errMsg),
        ),
      ),
    );
  }

  function handleBulkDashboardDelete(dashboardsToDelete: Dashboard[]) {
    return SupersetClient.delete({
      endpoint: `/api/v1/dashboard/?q=${rison.encode(
        dashboardsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        props.addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        props.addDangerToast(
          t('There was an issue deleting the selected dashboards: ', errMsg),
        ),
      ),
    );
  }

  function handleBulkDashboardExport(dashboardsToExport: Dashboard[]) {
    return window.location.assign(
      `/api/v1/dashboard/export/?q=${rison.encode(
        dashboardsToExport.map(({ id }) => id),
      )}`,
    );
  }

  function renderFaveStar(id: number) {
    return (
      <FaveStar
        itemId={id}
        fetchFaveStar={fetchFaveStar}
        saveFaveStar={saveFaveStar}
        isStarred={!!favoriteStatusRef.current[id]}
      />
    );
  }

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { id },
          },
        }: any) => renderFaveStar(id),
        Header: '',
        id: 'favorite',
        disableSortBy: true,
        size: 'xs',
      },
      {
        Cell: ({
          row: {
            original: { url, dashboard_title: dashboardTitle },
          },
        }: any) => <a href={url}>{dashboardTitle}</a>,
        Header: t('Title'),
        accessor: 'dashboard_title',
      },

      {
        Cell: ({
          row: {
            original: {
              changed_by_name: changedByName,
              changed_by_url: changedByUrl,
            },
          },
        }: any) => <a href={changedByUrl}>{changedByName}</a>,
        Header: t('Modified By'),
        accessor: 'changed_by.first_name',
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { published },
          },
        }: any) => (published ? t('Published') : t('Draft')),
        Header: t('Status'),
        accessor: 'published',
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { changed_on_delta_humanized: changedOn },
          },
        }: any) => <span className="no-wrap">{changedOn}</span>,
        Header: t('Modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { created_by: createdBy },
          },
        }: any) =>
          createdBy ? `${createdBy.first_name} ${createdBy.last_name}` : '',
        Header: t('Created By'),
        accessor: 'created_by',
        disableSortBy: true,
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { owners = [] },
          },
        }: any) => <FacePile users={owners} />,
        Header: t('Owners'),
        accessor: 'owners',
        disableSortBy: true,
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () => handleDashboardDelete(original);
          const handleEdit = () => openDashboardEditModal(original);
          const handleExport = () => handleBulkDashboardExport([original]);
          if (!canEdit && !canDelete && !canExport) {
            return null;
          }
          return (
            <span className="actions">
              {canDelete && (
                <ConfirmStatusChange
                  title={t('Please Confirm')}
                  description={
                    <>
                      {t('Are you sure you want to delete')}{' '}
                      <b>{original.dashboard_title}</b>?
                    </>
                  }
                  onConfirm={handleDelete}
                >
                  {confirmDelete => (
                    <TooltipWrapper
                      label="delete-action"
                      tooltip={t('Delete')}
                      placement="bottom"
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        className="action-button"
                        onClick={confirmDelete}
                      >
                        <Icon
                          data-test="dashboard-list-trash-icon"
                          name="trash"
                        />
                      </span>
                    </TooltipWrapper>
                  )}
                </ConfirmStatusChange>
              )}
              {canExport && (
                <TooltipWrapper
                  label="export-action"
                  tooltip={t('Export')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleExport}
                  >
                    <Icon name="share" />
                  </span>
                </TooltipWrapper>
              )}
              {canEdit && (
                <TooltipWrapper
                  label="edit-action"
                  tooltip={t('Edit')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleEdit}
                  >
                    <Icon name="edit-alt" />
                  </span>
                </TooltipWrapper>
              )}
            </span>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [canEdit, canDelete, canExport, favoriteStatusRef],
  );

  const filters: Filters = [
    {
      Header: t('Owner'),
      id: 'owners',
      input: 'select',
      operator: 'rel_m_m',
      unfilteredLabel: 'All',
      fetchSelects: createFetchRelated(
        'dashboard',
        'owners',
        createErrorHandler(errMsg =>
          props.addDangerToast(
            t(
              'An error occurred while fetching dashboard owner values: %s',
              errMsg,
            ),
          ),
        ),
      ),
      paginate: true,
    },
    {
      Header: t('Created By'),
      id: 'created_by',
      input: 'select',
      operator: 'rel_o_m',
      unfilteredLabel: 'All',
      fetchSelects: createFetchRelated(
        'dashboard',
        'created_by',
        createErrorHandler(errMsg =>
          props.addDangerToast(
            t(
              'An error occurred while fetching dashboard created by values: %s',
              errMsg,
            ),
          ),
        ),
      ),
      paginate: true,
    },
    {
      Header: t('Status'),
      id: 'published',
      input: 'select',
      operator: 'eq',
      unfilteredLabel: 'Any',
      selects: [
        { label: t('Published'), value: true },
        { label: t('Unpublished'), value: false },
      ],
    },
    {
      Header: t('Search'),
      id: 'dashboard_title',
      input: 'search',
      operator: 'title_or_slug',
    },
  ];

  const sortTypes = [
    {
      desc: false,
      id: 'dashboard_title',
      label: 'Alphabetical',
      value: 'alphabetical',
    },
    {
      desc: true,
      id: 'changed_on_delta_humanized',
      label: 'Recently Modified',
      value: 'recently_modified',
    },
    {
      desc: false,
      id: 'changed_on_delta_humanized',
      label: 'Least Recently Modified',
      value: 'least_recently_modified',
    },
  ];

  function renderCard(dashboard: Dashboard & { loading: boolean }) {
    const menu = (
      <Menu>
        {canDelete && (
          <Menu.Item>
            <ConfirmStatusChange
              title={t('Please Confirm')}
              description={
                <>
                  {t('Are you sure you want to delete')}{' '}
                  <b>{dashboard.dashboard_title}</b>?
                </>
              }
              onConfirm={() => handleDashboardDelete(dashboard)}
            >
              {confirmDelete => (
                <div
                  role="button"
                  tabIndex={0}
                  className="action-button"
                  onClick={confirmDelete}
                >
                  <ListViewCard.MenuIcon
                    data-test="dashboard-list-view-card-trash-icon"
                    name="trash"
                  />{' '}
                  Delete
                </div>
              )}
            </ConfirmStatusChange>
          </Menu.Item>
        )}
        {canExport && (
          <Menu.Item
            role="button"
            tabIndex={0}
            onClick={() => handleBulkDashboardExport([dashboard])}
          >
            <ListViewCard.MenuIcon name="share" /> Export
          </Menu.Item>
        )}
        {canEdit && (
          <Menu.Item
            data-test="dashboard-list-edit-option"
            role="button"
            tabIndex={0}
            onClick={() => openDashboardEditModal(dashboard)}
          >
            <ListViewCard.MenuIcon name="edit-alt" /> Edit
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <ListViewCard
        loading={dashboard.loading}
        title={dashboard.dashboard_title}
        titleRight={
          <Label>{dashboard.published ? 'published' : 'draft'}</Label>
        }
        url={bulkSelectEnabled ? undefined : dashboard.url}
        imgURL={dashboard.thumbnail_url}
        imgFallbackURL="/static/assets/images/dashboard-card-fallback.png"
        description={t(
          'Last modified %s',
          dashboard.changed_on_delta_humanized,
        )}
        coverLeft={<FacePile users={dashboard.owners || []} />}
        actions={
          <ListViewCard.Actions>
            {renderFaveStar(dashboard.id)}
            <Dropdown overlay={menu}>
              <Icon name="more-horiz" />
            </Dropdown>
          </ListViewCard.Actions>
        }
      />
    );
  }

  const subMenuButtons: SubMenuProps['buttons'] = [];
  if (canDelete || canExport) {
    subMenuButtons.push({
      name: t('Bulk Select'),
      buttonStyle: 'secondary',
      onClick: toggleBulkSelect,
    });
  }
  if (canCreate) {
    subMenuButtons.push({
      name: (
        <>
          {' '}
          <i className="fa fa-plus" /> {t('Dashboard')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        window.location.assign('/dashboard/new');
      },
    });
  }
  return (
    <>
      <SubMenu name={t('Dashboards')} buttons={subMenuButtons} />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected dashboards?',
        )}
        onConfirm={handleBulkDashboardDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canDelete) {
            bulkActions.push({
              key: 'delete',
              name: t('Delete'),
              type: 'danger',
              onSelect: confirmDelete,
            });
          }
          if (canExport) {
            bulkActions.push({
              key: 'export',
              name: t('Export'),
              type: 'primary',
              onSelect: handleBulkDashboardExport,
            });
          }
          return (
            <>
              {dashboardToEdit && (
                <PropertiesModal
                  dashboardId={dashboardToEdit.id}
                  show
                  onHide={() => setDashboardToEdit(null)}
                  onSubmit={handleDashboardEdit}
                />
              )}
              <ListView<Dashboard>
                bulkActions={bulkActions}
                bulkSelectEnabled={bulkSelectEnabled}
                cardSortSelectOptions={sortTypes}
                className="dashboard-list-view"
                columns={columns}
                count={dashboardCount}
                data={dashboards}
                disableBulkSelect={toggleBulkSelect}
                fetchData={fetchData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                pageSize={PAGE_SIZE}
                renderCard={renderCard}
                defaultViewMode={
                  isFeatureEnabled(FeatureFlag.LISTVIEWS_DEFAULT_CARD_VIEW)
                    ? 'card'
                    : 'table'
                }
              />
            </>
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(DashboardList);
