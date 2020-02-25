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
  charts: any[];
  chartCount: number;
  loading: boolean;
  filterOperators: FilterOperatorMap;
  filters: Filters;
  owners: Array<{ text: string; value: number }>;
  lastFetchDataConfig: FetchDataConfig | null;
  permissions: string[];
}

interface Chart {
  changed_on: string;
  creator: string;
  id: number;
  slice_name: string;
  url: string;
  viz_type: string;
}

class ChartList extends React.PureComponent<Props, State> {
  static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
  };

  state: State = {
    chartCount: 0,
    charts: [],
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
        endpoint: `/api/v1/chart/_info`,
      }),
      SupersetClient.get({
        endpoint: `/api/v1/chart/related/owners`,
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
        this.props.addDangerToast(t('An error occurred while fetching Charts'));
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

  initialSort = [{ id: 'changed_on', desc: true }];

  columns = [
    {
      Cell: ({
        row: {
          original: { url, slice_name: sliceName },
        },
      }: any) => <a href={url}>{sliceName}</a>,
      Header: t('Chart'),
      accessor: 'slice_name',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { viz_type: vizType },
        },
      }: any) => vizType,
      Header: t('Visualization Type'),
      accessor: 'viz_type',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: {
            datasource_name_text: dsNameTxt,
            datasource_link: dsLink,
          },
        },
      }: any) => <a href={dsLink}>{dsNameTxt}</a>,
      Header: t('Datasource'),
      accessor: 'datasource_name_text',
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
      }: any) => <a href={changedByName}>{changedByUrl}</a>,
      Header: t('Creator'),
      accessor: 'creator',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { changed_on: changedOn },
        },
      }: any) => <span className="no-wrap">{moment(changedOn).fromNow()}</span>,
      Header: t('Last Modified'),
      accessor: 'changed_on',
      sortable: true,
    },
    {
      Cell: ({ row: { state, original } }: any) => {
        const handleDelete = () => this.handleChartDelete(original);
        const handleEdit = () => this.handleChartEdit(original);
        if (!this.canEdit && !this.canDelete) {
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
                    <b>{original.slice_name}</b>?
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
      Header: 'Actions',
      id: 'actions',
    },
  ];

  hasPerm = (perm: string) => {
    if (!this.state.permissions.length) {
      return false;
    }

    return this.state.permissions.some(p => p === perm);
  };

  handleChartEdit = ({ id }: { id: number }) => {
    window.location.assign(`/chart/edit/${id}`);
  };

  handleChartDelete = ({ id, slice_name: sliceName }: Chart) => {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/${id}`,
    }).then(
      () => {
        const { lastFetchDataConfig } = this.state;
        if (lastFetchDataConfig) {
          this.fetchData(lastFetchDataConfig);
        }
        this.props.addSuccessToast(t('Deleted: %(slice_name)', sliceName));
      },
      () => {
        this.props.addDangerToast(
          t('There was an issue deleting: %(slice_name)', sliceName),
        );
      },
    );
  };

  handleBulkDashboardDelete = (charts: Chart[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dashboard/?q=!(${charts
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

  fetchData = ({ pageIndex, pageSize, sortBy, filters }: FetchDataConfig) => {
    this.setState({ loading: true });
    const filterExps = Object.keys(filters).map(fk => ({
      col: fk,
      opr: filters[fk].filterId,
      value: filters[fk].filterValue,
    }));

    const queryParams = JSON.stringify({
      order_column: sortBy[0].id,
      order_direction: sortBy[0].desc ? 'desc' : 'asc',
      page: pageIndex,
      page_size: pageSize,
      ...(filterExps.length ? { filters: filterExps } : {}),
    });

    return SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${queryParams}`,
    })
      .then(({ json = {} }) => {
        this.setState({ charts: json.result, chartCount: json.count });
      })
      .catch(() => {
        this.props.addDangerToast(t('An error occurred while fetching Charts'));
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
          Header: 'Chart',
          id: 'slice_name',
          operators: filterOperators.slice_name.map(convertFilter),
        },
        {
          Header: 'Description',
          id: 'description',
          input: 'textarea',
          operators: filterOperators.slice_name.map(convertFilter),
        },
        {
          Header: 'Visualization Type',
          id: 'viz_type',
          operators: filterOperators.viz_type.map(convertFilter),
        },
        {
          Header: 'Datasource Name',
          id: 'datasource_name',
          operators: filterOperators.datasource_name.map(convertFilter),
        },
        {
          Header: 'Owners',
          id: 'owners',
          input: 'select',
          operators: filterOperators.owners.map(convertFilter),
          selects: owners.map(({ text: label, value }) => ({ label, value })),
        },
      ],
    });
  };

  render() {
    const { charts, chartCount, loading, filters } = this.state;
    return (
      <div className="container welcome">
        <Panel>
          <ConfirmStatusChange
            title={t('Please confirm')}
            description={t(
              'Are you sure you want to delete the selected charts?',
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
              return (
                <ListView
                  className="chart-list-view"
                  title={'Charts'}
                  columns={this.columns}
                  data={charts}
                  count={chartCount}
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

export default withToasts(ChartList);
