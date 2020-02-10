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
import { Button, Modal, Panel } from 'react-bootstrap';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ListView from 'src/components/ListView/ListView';
import { FetchDataConfig, FilterTypeMap } from 'src/components/ListView/types';
import withToasts from 'src/messageToasts/enhancers/withToasts';

const PAGE_SIZE = 25;

interface Props {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

interface State {
  chartCount: number;
  charts: any[];
  filterTypes: FilterTypeMap;
  labelColumns: { [key: string]: string };
  lastFetchDataConfig: FetchDataConfig | null;
  loading: boolean;
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

  get canEdit() {
    return this.hasPerm('can_edit');
  }

  get canDelete() {
    return this.hasPerm('can_delete');
  }

  public static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
  };

  public state: State = {
    chartCount: 0,
    charts: [],
    filterTypes: {},
    labelColumns: {},
    lastFetchDataConfig: null,
    loading: false,
    permissions: [],
  };

  public initialSort = [{ id: 'changed_on', desc: true }];

  public columns = [
    {
      Cell: ({
        row: {
          original: { url, slice_name },
        },
      }: any) => <a href={url}>{slice_name}</a>,
      Header: t('Chart'),
      accessor: 'slice_name',
      filterable: true,
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { viz_type },
        },
      }: any) => viz_type,
      Header: t('Visualization Type'),
      accessor: 'viz_type',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { datasource_name_text, datasource_link },
        },
      }: any) => <a href={datasource_link}>{datasource_name_text}</a>,
      Header: t('Datasource'),
      accessor: 'datasource_name_text',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { changed_by_name, changed_by_url },
        },
      }: any) => <a href={changed_by_url}>{changed_by_name}</a>,
      Header: t('Creator'),
      accessor: 'creator',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { changed_on },
        },
      }: any) => (
          <span className='no-wrap'>{moment(changed_on).fromNow()}</span>
        ),
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
          <span className={`actions ${state && state.hover ? '' : 'invisible'}`}>
            {this.canDelete && (
              <ConfirmStatusChange
                title={t('Please Confirm')}
                description={<>{t('Are you sure you want to delete')} <b>{original.slice_name}</b>?</>}
                onConfirm={handleDelete}
              >
                {(confirmDelete) => (
                  <span
                    role='button'
                    className='action-button'
                    onClick={confirmDelete}
                  >
                    <i className='fa fa-trash' />
                  </span>
                )}
              </ConfirmStatusChange>
            )}
            {this.canEdit && (
              <span
                role='button'
                className='action-button'
                onClick={handleEdit}
              >
                <i className='fa fa-pencil' />
              </span>
            )}
          </span>
        );
      },
      Header: 'Actions',
      id: 'actions',
    },
  ];

  public hasPerm = (perm: string) => {
    if (!this.state.permissions.length) {
      return false;
    }

    return this.state.permissions.some((p) => p === perm);
  }

  public handleChartEdit = ({ id }: { id: number }) => {
    window.location.assign(`/chart/edit/${id}`);
  }

  public handleChartDelete = ({ id, slice_name }: Chart) => {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/${id}`,
    }).then(
      (resp) => {
        const { lastFetchDataConfig } = this.state;
        if (lastFetchDataConfig) {
          this.fetchData(lastFetchDataConfig);
        }
        this.props.addSuccessToast(t('Deleted: %(slice_name)', slice_name));
      },
      (err: any) => {
        this.props.addDangerToast(t('There was an issue deleting: %(slice_name)', slice_name));
      },
    );
  }
  public handleBulkDashboardDelete = (charts: Chart[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dashboard/?q=!(${charts.map(({ id }) => id).join(',')})`,
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
        this.props.addDangerToast(t('There was an issue deleting the selected dashboards'));
      },
    );
  }

  public fetchData = ({
    pageIndex,
    pageSize,
    sortBy,
    filters,
  }: FetchDataConfig) => {
    this.setState({ loading: true });
    const filterExps = Object.keys(filters).map((fk) => ({
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
        this.setState({ charts: json.result, chartCount: json.count, labelColumns: json.label_columns });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching Charts'),
        );
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  }

  public componentDidMount() {
    SupersetClient.get({
      endpoint: `/api/v1/chart/_info`,
    })
      .then(({ json = {} }) => {
        this.setState({ filterTypes: json.filters, permissions: json.permissions });
      });
  }

  public render() {
    const { charts, chartCount, loading, filterTypes } = this.state;
    return (
      <div className='container welcome'>
        <Panel>

          <ConfirmStatusChange
            title={t('Please confirm')}
            description={t('Are you sure you want to delete the selected charts?')}
            onConfirm={this.handleBulkDashboardDelete}
          >
            {(confirmDelete) => {
              const bulkActions = [];
              if (this.canDelete) {
                bulkActions.push({
                  key: 'delete',
                  name: <><i className='fa fa-trash' /> Delete</>,
                  onSelect: confirmDelete,
                });
              }
              return (
                <ListView
                  className='chart-list-view'
                  title={'Charts'}
                  columns={this.columns}
                  data={charts}
                  count={chartCount}
                  pageSize={PAGE_SIZE}
                  fetchData={this.fetchData}
                  loading={loading}
                  initialSort={this.initialSort}
                  filterTypes={filterTypes}
                  bulkActions={bulkActions}
                />
              );
            }}
          </ConfirmStatusChange>
        </Panel>
      </div >
    );
  }
}

export default withToasts(ChartList);
