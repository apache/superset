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
import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
// @ts-ignore
import { Panel } from 'react-bootstrap';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ListView from 'src/components/ListView/ListView';
import {
  FetchDataConfig,
  FilterOperatorMap,
  Filters,
} from 'src/components/ListView/types';
import withToasts from 'src/messageToasts/enhancers/withToasts';

const PAGE_SIZE = 25;

interface Props {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

interface State {
  dashboards: any[];
  dashboardCount: number;
  loading: boolean;
  filterOperators: FilterOperatorMap;
  filters: Filters;
  owners: Array<{ text: string; value: number }>;
  permissions: string[];
  lastFetchDataConfig: FetchDataConfig | null;
}

interface Dashboard {
  id: number;
  changed_by: string;
  changed_by_name: string;
  changed_by_url: string;
  changed_on: string;
  dashboard_title: string;
  published: boolean;
  url: string;
}

class DashboardList extends React.PureComponent<Props, State> {
  static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
  };

  state: State = {
    dashboardCount: 0,
    dashboards: [],
    filterOperators: {},
    filters: [],
    lastFetchDataConfig: null,
    loading: false,
    owners: [],
    permissions: [],
  };

  componentDidMount() {
    Promise.all([
      SupersetClient.get({
        endpoint: `/api/v1/dashboard/_info`,
      }),
      SupersetClient.get({
        endpoint: `/api/v1/dashboard/related/owners`,
      }),
    ]).then(
      ([{ json: infoJson = {} }, { json: ownersJson = {} }]) => {
        this.setState(
          {
            filterOperators: infoJson.filters,
            owners: ownersJson.result,
            permissions: infoJson.permissions,
          },
          this.updateFilters,
        );
      },
      ([e1, e2]) => {
        this.props.addDangerToast(
          t('An error occurred while fetching Dashboards'),
        );
        if (e1) {
          console.error(e1);
        }
        if (e2) {
          console.error(e2);
        }
      },
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

  initialSort = [{ id: 'changed_on', desc: true }];

  columns = [
    {
      Cell: ({
        row: {
          original: { url, dashboard_title: dashboardTitle },
        },
      }: any) => <a href={url}>{dashboardTitle}</a>,
      Header: t('Title'),
      accessor: 'dashboard_title',
      sortable: true,
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
      Header: t('Creator'),
      accessor: 'changed_by_fk',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { published },
        },
      }: any) => (
        <span className="no-wrap">
          {published ? <i className="fa fa-check" /> : ''}
        </span>
      ),
      Header: t('Published'),
      accessor: 'published',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { changed_on: changedOn },
        },
      }: any) => <span className="no-wrap">{moment(changedOn).fromNow()}</span>,
      Header: t('Modified'),
      accessor: 'changed_on',
      sortable: true,
    },
    {
      accessor: 'slug',
    },
    {
      accessor: 'owners',
    },
    {
      Cell: ({ row: { state, original } }: any) => {
        const handleDelete = () => this.handleDashboardDelete(original);
        const handleEdit = () => this.handleDashboardEdit(original);
        const handleExport = () => this.handleBulkDashboardExport([original]);
        if (!this.canEdit && !this.canDelete && !this.canExport) {
          return null;
        }
        return (
          <span
            className={`actions ${state && state.hover ? '' : 'invisible'}`}
          >
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
                    <i className="fa fa-trash" />
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
                <i className="fa fa-database" />
              </span>
            )}
            {this.canEdit && (
              <span
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={handleEdit}
              >
                <i className="fa fa-pencil" />
              </span>
            )}
          </span>
        );
      },
      Header: t('Actions'),
      id: 'actions',
    },
  ];

  hasPerm = (perm: string) => {
    if (!this.state.permissions.length) {
      return false;
    }

    return Boolean(this.state.permissions.find(p => p === perm));
  };

  handleDashboardEdit = ({ id }: { id: number }) => {
    window.location.assign(`/dashboard/edit/${id}`);
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
        this.props.addSuccessToast(`${t('Deleted')} ${dashboardTitle}`);
      },
      (err: any) => {
        console.error(err);
        this.props.addDangerToast(
          `${t('There was an issue deleting')}${dashboardTitle}`,
        );
      },
    );

  handleBulkDashboardDelete = (dashboards: Dashboard[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dashboard/?q=!(${dashboards
        .map(({ id }) => id)
        .join(',')})`,
    }).then(
      ({ json = {} }) => {
        const { lastFetchDataConfig } = this.state;
        if (lastFetchDataConfig) {
          this.fetchData(lastFetchDataConfig);
        }
        this.props.addSuccessToast(json.message);
      },
      (err: any) => {
        console.error(err);
        this.props.addDangerToast(
          t('There was an issue deleting the selected dashboards'),
        );
      },
    );
  };

  handleBulkDashboardExport = (dashboards: Dashboard[]) => {
    return window.location.assign(
      `/api/v1/dashboard/export/?q=!(${dashboards
        .map(({ id }) => id)
        .join(',')})`,
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

    const queryParams = JSON.stringify({
      order_column: sortBy[0].id,
      order_direction: sortBy[0].desc ? 'desc' : 'asc',
      page: pageIndex,
      page_size: pageSize,
      ...(filterExps.length ? { filters: filterExps } : {}),
    });

    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${queryParams}`,
    })
      .then(({ json = {} }) => {
        this.setState({ dashboards: json.result, dashboardCount: json.count });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching Dashboards'),
        );
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  updateFilters = () => {
    const { filterOperators, owners } = this.state;
    const convertFilter = ({
      name: label,
      operator,
    }: {
      name: string;
      operator: string;
    }) => ({ label, value: operator });

    this.setState({
      filters: [
        {
          Header: 'Dashboard',
          id: 'dashboard_title',
          operators: filterOperators.dashboard_title.map(convertFilter),
        },
        {
          Header: 'Slug',
          id: 'slug',
          operators: filterOperators.slug.map(convertFilter),
        },
        {
          Header: 'Owners',
          id: 'owners',
          input: 'select',
          operators: filterOperators.owners.map(convertFilter),
          selects: owners.map(({ text: label, value }) => ({ label, value })),
        },
        {
          Header: 'Published',
          id: 'published',
          input: 'checkbox',
          operators: filterOperators.published.map(convertFilter),
        },
      ],
    });
  };

  render() {
    const { dashboards, dashboardCount, loading, filters } = this.state;

    return (
      <div className="container welcome">
        <Panel>
          <ConfirmStatusChange
            title={t('Please confirm')}
            description={t(
              'Are you sure you want to delete the selected dashboards?',
            )}
            onConfirm={this.handleBulkDashboardDelete}
          >
            {confirmDelete => {
              const bulkActions = [];
              if (this.canDelete) {
                bulkActions.push({
                  key: 'delete',
                  name: (
                    <>
                      <i className="fa fa-trash" /> Delete
                    </>
                  ),
                  onSelect: confirmDelete,
                });
              }
              if (this.canExport) {
                bulkActions.push({
                  key: 'export',
                  name: (
                    <>
                      <i className="fa fa-database" /> Export
                    </>
                  ),
                  onSelect: this.handleBulkDashboardExport,
                });
              }
              return (
                <ListView
                  className="dashboard-list-view"
                  title={'Dashboards'}
                  columns={this.columns}
                  data={dashboards}
                  count={dashboardCount}
                  pageSize={PAGE_SIZE}
                  fetchData={this.fetchData}
                  loading={loading}
                  initialSort={this.initialSort}
                  filters={filters}
                  bulkActions={bulkActions}
                />
              );
            }}
          </ConfirmStatusChange>
        </Panel>
      </div>
    );
  }
}

export default withToasts(DashboardList);
