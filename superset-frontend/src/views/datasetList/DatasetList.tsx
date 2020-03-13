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
import Link from 'src/components/Link';
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
  datasets: any[];
  datasetCount: number;
  loading: boolean;
  filterOperators: FilterOperatorMap;
  filters: Filters;
  owners: Array<{ text: string; value: number }>;
  databases: Array<{ text: string; value: number }>;
  permissions: string[];
  lastFetchDataConfig: FetchDataConfig | null;
}

interface Dataset {
  changed_by_name: string;
  changed_by_url: string;
  changed_by: string;
  changed_on: string;
  databse_name: string;
  explore_url: string;
  id: number;
  schema: string;
  table_name: string;
}

class DatasetList extends React.PureComponent<Props, State> {
  static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
  };

  state: State = {
    datasetCount: 0,
    datasets: [],
    filterOperators: {},
    filters: [],
    lastFetchDataConfig: null,
    loading: false,
    owners: [],
    databases: [],
    permissions: [],
  };

  componentDidMount() {
    Promise.all([
      SupersetClient.get({
        endpoint: `/api/v1/dataset/_info`,
      }),
      SupersetClient.get({
        endpoint: `/api/v1/dataset/related/owners`,
      }),
      SupersetClient.get({
        endpoint: `/api/v1/dataset/related/database`,
      }),
    ]).then(
      ([
        { json: infoJson = {} },
        { json: ownersJson = {} },
        { json: databasesJson = {} },
      ]) => {
        this.setState(
          {
            filterOperators: infoJson.filters,
            owners: ownersJson.result,
            databases: databasesJson.result,
            permissions: infoJson.permissions,
          },
          this.updateFilters,
        );
      },
      ([e1, e2]) => {
        this.props.addDangerToast(
          t('An error occurred while fetching Datasets'),
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

  get canCreate() {
    return this.hasPerm('can_add');
  }

  initialSort = [{ id: 'changed_on', desc: true }];

  columns = [
    {
      Cell: ({
        row: {
          original: { explore_url: exploreUrl, table_name: datasetTitle },
        },
      }: any) => <a href={exploreUrl}>{datasetTitle}</a>,
      Header: t('Table'),
      accessor: 'table_name',
    },
    {
      Header: t('Databse'),
      accessor: 'database_name',
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
      Header: t('Changed By'),
      accessor: 'changed_by_fk',
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
      accessor: 'database',
      hidden: true,
    },
    {
      accessor: 'schema',
      hidden: true,
    },
    {
      accessor: 'owners',
      hidden: true,
    },
    {
      accessor: 'is_sqllab_view',
      hidden: true,
    },
    {
      Cell: ({ row: { state, original } }: any) => {
        const handleDelete = () => this.handleDatasetDelete(original);
        const handleEdit = () => this.handleDatasetEdit(original);
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
                    {t('Are you sure you want to delete ')}{' '}
                    <b>{original.table_name}</b>?
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

  handleDatasetEdit = ({ id }: { id: number }) => {
    window.location.assign(`/tablemodelview/edit/${id}`);
  };

  handleDatasetDelete = ({ id, table_name: tableName }: Dataset) =>
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/${id}`,
    }).then(
      () => {
        const { lastFetchDataConfig } = this.state;
        if (lastFetchDataConfig) {
          this.fetchData(lastFetchDataConfig);
        }
        this.props.addSuccessToast(t('Deleted: %s', tableName));
      },
      (err: any) => {
        console.error(err);
        this.props.addDangerToast(
          t('There was an issue deleting %s', tableName),
        );
      },
    );

  handleBulkDatasetDelete = (datasets: Dataset[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/?q=!(${datasets
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
          t('There was an issue deleting the selected datasets'),
        );
      },
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
      endpoint: `/api/v1/dataset/?q=${queryParams}`,
    })
      .then(({ json = {} }) => {
        this.setState({ datasets: json.result, datasetCount: json.count });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching Datasets'),
        );
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  updateFilters = () => {
    const { filterOperators, owners, databases } = this.state;
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
          Header: 'Database',
          id: 'database',
          input: 'select',
          operators: filterOperators.database.map(convertFilter),
          selects: databases.map(({ text: label, value }) => ({
            label,
            value,
          })),
        },
        {
          Header: 'Schema',
          id: 'schema',
          operators: filterOperators.schema.map(convertFilter),
        },
        {
          Header: 'Table Name',
          id: 'table_name',
          operators: filterOperators.table_name.map(convertFilter),
        },
        {
          Header: 'Owners',
          id: 'owners',
          input: 'select',
          operators: filterOperators.owners.map(convertFilter),
          selects: owners.map(({ text: label, value }) => ({ label, value })),
        },
        {
          Header: 'SQL Lab View',
          id: 'is_sqllab_view',
          input: 'checkbox',
          operators: filterOperators.is_sqllab_view.map(convertFilter),
        },
      ],
    });
  };

  render() {
    const { datasets, datasetCount, loading, filters } = this.state;

    return (
      <div className="container welcome">
        <Panel>
          <ConfirmStatusChange
            title={t('Please confirm')}
            description={t(
              'Are you sure you want to delete the selected datasets?',
            )}
            onConfirm={this.handleBulkDatasetDelete}
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
                <>
                  {this.canCreate && (
                    <span className="list-add-action">
                      <Link
                        className="btn btn-sm btn-primary pull-right"
                        href="/tablemodelview/add"
                        tooltip="Add a new record"
                      >
                        <i className="fa fa-plus" />
                      </Link>
                    </span>
                  )}
                  <ListView
                    className="dataset-list-view"
                    title={'Datasets'}
                    columns={this.columns}
                    data={datasets}
                    count={datasetCount}
                    pageSize={PAGE_SIZE}
                    fetchData={this.fetchData}
                    loading={loading}
                    initialSort={this.initialSort}
                    filters={filters}
                    bulkActions={bulkActions}
                  />
                </>
              );
            }}
          </ConfirmStatusChange>
        </Panel>
      </div>
    );
  }
}

export default withToasts(DatasetList);
