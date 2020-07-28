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
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';
import PropTypes from 'prop-types';
import React from 'react';
import rison from 'rison';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu from 'src/components/Menu/SubMenu';
import ListView, { ListViewProps } from 'src/components/ListView/ListView';
import ExpandableList from 'src/components/ExpandableList';
import { FetchDataConfig, Filters } from 'src/components/ListView/types';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import Icon from 'src/components/Icon';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';

const PAGE_SIZE = 25;

interface Props {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

interface State {
  bulkSelectEnabled: boolean;
  dashboardCount: number;
  dashboards: any[];
  dashboardToEdit: Dashboard | null;
  lastFetchDataConfig: FetchDataConfig | null;
  loading: boolean;
  permissions: string[];
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
}

class DashboardList extends React.PureComponent<Props, State> {
  static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
  };

  state: State = {
    bulkSelectEnabled: false,
    dashboardCount: 0,
    dashboards: [],
    dashboardToEdit: null,
    lastFetchDataConfig: null,
    loading: true,
    permissions: [],
  };

  componentDidMount() {
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/_info`,
    }).then(
      ({ json: infoJson = {} }) => {
        this.setState({
          permissions: infoJson.permissions,
        });
      },
      createErrorHandler(errMsg =>
        this.props.addDangerToast(
          t('An error occurred while fetching Dashboards: %s, %s', errMsg),
        ),
      ),
    );
  }

  get canEdit() {
    return this.hasPerm('can_edit');
  }

  get canDelete() {
    return this.hasPerm('can_delete');
  }

  get canExport() {
    return this.hasPerm('can_mulexport');
  }

  initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  columns = [
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
          original: { owners },
        },
      }: any) => (
        <ExpandableList
          items={owners.map(
            ({ first_name: firstName, last_name: lastName }: any) =>
              `${firstName} ${lastName}`,
          )}
          display={2}
        />
      ),
      Header: t('Owners'),
      accessor: 'owners',
      disableSortBy: true,
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
    },
    {
      Cell: ({
        row: {
          original: { published },
        },
      }: any) => (
        <span className="no-wrap">
          {published ? <Icon name="check" /> : ''}
        </span>
      ),
      Header: t('Published'),
      accessor: 'published',
    },
    {
      Cell: ({
        row: {
          original: { changed_on_delta_humanized: changedOn },
        },
      }: any) => <span className="no-wrap">{changedOn}</span>,
      Header: t('Modified'),
      accessor: 'changed_on_delta_humanized',
    },
    {
      accessor: 'slug',
      hidden: true,
      disableSortBy: true,
    },
    {
      Cell: ({ row: { original } }: any) => {
        const handleDelete = () => this.handleDashboardDelete(original);
        const handleEdit = () => this.openDashboardEditModal(original);
        const handleExport = () => this.handleBulkDashboardExport([original]);
        if (!this.canEdit && !this.canDelete && !this.canExport) {
          return null;
        }
        return (
          <span className="actions">
            {this.canDelete && (
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
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={confirmDelete}
                  >
                    <Icon name="trash" />
                  </span>
                )}
              </ConfirmStatusChange>
            )}
            {this.canExport && (
              <span
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={handleExport}
              >
                <Icon name="share" />
              </span>
            )}
            {this.canEdit && (
              <span
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={handleEdit}
              >
                <Icon name="pencil" />
              </span>
            )}
          </span>
        );
      },
      Header: t('Actions'),
      id: 'actions',
      disableSortBy: true,
    },
  ];

  toggleBulkSelect = () => {
    this.setState({ bulkSelectEnabled: !this.state.bulkSelectEnabled });
  };

  filters: Filters = [
    {
      Header: 'Owner',
      id: 'owners',
      input: 'select',
      operator: 'rel_m_m',
      unfilteredLabel: 'All',
      fetchSelects: createFetchRelated(
        'dashboard',
        'owners',
        createErrorHandler(errMsg =>
          this.props.addDangerToast(
            t(
              'An error occurred while fetching chart owner values: %s',
              errMsg,
            ),
          ),
        ),
      ),
      paginate: true,
    },
    {
      Header: 'Published',
      id: 'published',
      input: 'select',
      operator: 'eq',
      unfilteredLabel: 'Any',
      selects: [
        { label: 'Published', value: true },
        { label: 'Unpublished', value: false },
      ],
    },
    {
      Header: 'Search',
      id: 'dashboard_title',
      input: 'search',
      operator: 'title_or_slug',
    },
  ];

  hasPerm = (perm: string) => {
    if (!this.state.permissions.length) {
      return false;
    }

    return Boolean(this.state.permissions.find(p => p === perm));
  };

  openDashboardEditModal = (dashboard: Dashboard) => {
    this.setState({
      dashboardToEdit: dashboard,
    });
  };

  handleDashboardEdit = (edits: any) => {
    this.setState({ loading: true });
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/${edits.id}`,
    }).then(
      ({ json = {} }) => {
        this.setState({
          dashboards: this.state.dashboards.map(dashboard => {
            if (dashboard.id === json.id) {
              return json.result;
            }
            return dashboard;
          }),
          loading: false,
        });
      },
      createErrorHandler(errMsg =>
        this.props.addDangerToast(
          t('An error occurred while fetching dashboards: %s', errMsg),
        ),
      ),
    );
  };

  handleDashboardDelete = ({
    id,
    dashboard_title: dashboardTitle,
  }: Dashboard) =>
    SupersetClient.delete({
      endpoint: `/api/v1/dashboard/${id}`,
    }).then(
      () => {
        const { lastFetchDataConfig } = this.state;
        if (lastFetchDataConfig) {
          this.fetchData(lastFetchDataConfig);
        }
        this.props.addSuccessToast(t('Deleted: %s', dashboardTitle));
      },
      createErrorHandler(errMsg =>
        this.props.addDangerToast(
          t('There was an issue deleting %s: %s', dashboardTitle, errMsg),
        ),
      ),
    );

  handleBulkDashboardDelete = (dashboards: Dashboard[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dashboard/?q=${rison.encode(
        dashboards.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        const { lastFetchDataConfig } = this.state;
        if (lastFetchDataConfig) {
          this.fetchData(lastFetchDataConfig);
        }
        this.props.addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        this.props.addDangerToast(
          t('There was an issue deleting the selected dashboards: ', errMsg),
        ),
      ),
    );
  };

  handleBulkDashboardExport = (dashboards: Dashboard[]) => {
    return window.location.assign(
      `/api/v1/dashboard/export/?q=${rison.encode(
        dashboards.map(({ id }) => id),
      )}`,
    );
  };

  fetchData = ({ pageIndex, pageSize, sortBy, filters }: FetchDataConfig) => {
    // set loading state, cache the last config for fetching data in this component.
    this.setState({
      lastFetchDataConfig: {
        filters,
        pageIndex,
        pageSize,
        sortBy,
      },
      loading: true,
    });
    const filterExps = filters.map(({ id: col, operator: opr, value }) => ({
      col,
      opr,
      value,
    }));

    const queryParams = rison.encode({
      order_column: sortBy[0].id,
      order_direction: sortBy[0].desc ? 'desc' : 'asc',
      page: pageIndex,
      page_size: pageSize,
      ...(filterExps.length ? { filters: filterExps } : {}),
    });

    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${queryParams}`,
    })
      .then(
        ({ json = {} }) => {
          this.setState({
            dashboards: json.result,
            dashboardCount: json.count,
          });
        },
        createErrorHandler(errMsg =>
          this.props.addDangerToast(
            t('An error occurred while fetching dashboards: %s', errMsg),
          ),
        ),
      )
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  render() {
    const {
      bulkSelectEnabled,
      dashboards,
      dashboardCount,
      loading,
      dashboardToEdit,
    } = this.state;
    return (
      <>
        <SubMenu
          name={t('Dashboards')}
          secondaryButton={
            this.canDelete || this.canExport
              ? {
                  name: t('Bulk Select'),
                  onClick: this.toggleBulkSelect,
                }
              : undefined
          }
        />
        <ConfirmStatusChange
          title={t('Please confirm')}
          description={t(
            'Are you sure you want to delete the selected dashboards?',
          )}
          onConfirm={this.handleBulkDashboardDelete}
        >
          {confirmDelete => {
            const bulkActions: ListViewProps['bulkActions'] = [];
            if (this.canDelete) {
              bulkActions.push({
                key: 'delete',
                name: t('Delete'),
                type: 'danger',
                onSelect: confirmDelete,
              });
            }
            if (this.canExport) {
              bulkActions.push({
                key: 'export',
                name: t('Export'),
                type: 'primary',
                onSelect: this.handleBulkDashboardExport,
              });
            }
            return (
              <>
                {dashboardToEdit && (
                  <PropertiesModal
                    dashboardId={dashboardToEdit.id}
                    onDashboardSave={this.handleDashboardEdit}
                    onHide={() => this.setState({ dashboardToEdit: null })}
                    show
                  />
                )}
                <ListView
                  bulkActions={bulkActions}
                  bulkSelectEnabled={bulkSelectEnabled}
                  className="dashboard-list-view"
                  columns={this.columns}
                  count={dashboardCount}
                  data={dashboards}
                  disableBulkSelect={this.toggleBulkSelect}
                  fetchData={this.fetchData}
                  filters={this.filters}
                  initialSort={this.initialSort}
                  loading={loading}
                  pageSize={PAGE_SIZE}
                />
              </>
            );
          }}
        </ConfirmStatusChange>
      </>
    );
  }
}

export default withToasts(DashboardList);
