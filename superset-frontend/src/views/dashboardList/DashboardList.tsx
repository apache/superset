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
// @ts-ignore
import { Panel } from 'react-bootstrap';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu from 'src/components/Menu/SubMenu';
import ListView, { ListViewProps } from 'src/components/ListView/ListView';
import ExpandableList from 'src/components/ExpandableList';
import {
  FetchDataConfig,
  FilterOperatorMap,
  Filters,
} from 'src/components/ListView/types';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';

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
  filterOperators: FilterOperatorMap;
  filters: Filters;
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
    filterOperators: {},
    filters: [],
    lastFetchDataConfig: null,
    loading: true,
    permissions: [],
  };

  componentDidMount() {
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/_info`,
    }).then(
      ({ json: infoJson = {} }) => {
        this.setState(
          {
            filterOperators: infoJson.filters,
            permissions: infoJson.permissions,
          },
          this.updateFilters,
        );
      },
      e => {
        this.props.addDangerToast(
          t(
            'An error occurred while fetching Dashboards: %s, %s',
            e.statusText,
          ),
        );
        console.error(e);
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

  get isSIP34FilterUIEnabled() {
    return isFeatureEnabled(FeatureFlag.LIST_VIEWS_SIP34_FILTER_UI);
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
          {published ? <i className="fa fa-check" /> : ''}
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
      disableSortBy: true,
    },
  ];

  toggleBulkSelect = () => {
    this.setState({ bulkSelectEnabled: !this.state.bulkSelectEnabled });
  };

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
    })
      .then(({ json = {} }) => {
        this.setState({
          dashboards: this.state.dashboards.map(dashboard => {
            if (dashboard.id === json.id) {
              return json.result;
            }
            return dashboard;
          }),
          loading: false,
        });
      })
      .catch(e => {
        this.props.addDangerToast(
          t('An error occurred while fetching dashboards: %s', e.statusText),
        );
      });
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
      (err: any) => {
        console.error(err);
        this.props.addDangerToast(
          t('There was an issue deleting %s', dashboardTitle),
        );
      },
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
      (err: any) => {
        console.error(err);
        this.props.addDangerToast(
          t(
            'There was an issue deleting the selected dashboards: ',
            err.statusText,
          ),
        );
      },
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
      .then(({ json = {} }) => {
        this.setState({ dashboards: json.result, dashboardCount: json.count });
      })
      .catch(e => {
        this.props.addDangerToast(
          t('An error occurred while fetching dashboards: %s', e.statusText),
        );
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  fetchOwners = async (
    filterValue = '',
    pageIndex?: number,
    pageSize?: number,
  ) => {
    const resource = '/api/v1/dashboard/related/owners';

    try {
      const queryParams = rison.encode({
        ...(pageIndex ? { page: pageIndex } : {}),
        ...(pageSize ? { page_ize: pageSize } : {}),
        ...(filterValue ? { filter: filterValue } : {}),
      });
      const { json = {} } = await SupersetClient.get({
        endpoint: `${resource}?q=${queryParams}`,
      });

      return json?.result?.map(
        ({ text: label, value }: { text: string; value: any }) => ({
          label,
          value,
        }),
      );
    } catch (e) {
      console.error(e);
      this.props.addDangerToast(
        t(
          'An error occurred while fetching chart owner values: %s',
          e.statusText,
        ),
      );
    }
    return [];
  };

  updateFilters = async () => {
    const { filterOperators } = this.state;

    if (this.isSIP34FilterUIEnabled) {
      return this.setState({
        filters: [
          {
            Header: 'Owner',
            id: 'owners',
            input: 'select',
            operator: 'rel_m_m',
            unfilteredLabel: 'All',
            fetchSelects: this.fetchOwners,
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
        ],
      });
    }

    const convertFilter = ({
      name: label,
      operator,
    }: {
      name: string;
      operator: string;
    }) => ({ label, value: operator });

    const owners = await this.fetchOwners();

    return this.setState({
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
          selects: owners,
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
    const {
      bulkSelectEnabled,
      dashboardCount,
      dashboards,
      dashboardToEdit,
      filters,
      loading,
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
                    show
                    dashboardId={dashboardToEdit.id}
                    onHide={() => this.setState({ dashboardToEdit: null })}
                    onDashboardSave={this.handleDashboardEdit}
                  />
                )}
                <ListView
                  className="dashboard-list-view"
                  columns={this.columns}
                  data={dashboards}
                  count={dashboardCount}
                  pageSize={PAGE_SIZE}
                  fetchData={this.fetchData}
                  loading={loading}
                  initialSort={this.initialSort}
                  filters={filters}
                  bulkActions={bulkActions}
                  bulkSelectEnabled={bulkSelectEnabled}
                  disableBulkSelect={this.toggleBulkSelect}
                  isSIP34FilterUIEnabled={this.isSIP34FilterUIEnabled}
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
