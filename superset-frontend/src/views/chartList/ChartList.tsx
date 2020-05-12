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
import { getChartMetadataRegistry } from '@superset-ui/chart';
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
import PropertiesModal, { Slice } from 'src/explore/components/PropertiesModal';
import Chart from 'src/types/Chart';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';

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
  lastFetchDataConfig: FetchDataConfig | null;
  permissions: string[];
  // for now we need to use the Slice type defined in PropertiesModal.
  // In future it would be better to have a unified Chart entity.
  sliceCurrentlyEditing: Slice | null;
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
    permissions: [],
    sliceCurrentlyEditing: null,
  };

  componentDidMount() {
    SupersetClient.get({
      endpoint: `/api/v1/chart/_info`,
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
          t('An error occurred while fetching charts: %s', e.statusText),
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

  get isNewUIEnabled() {
    return isFeatureEnabled(FeatureFlag.LIST_VIEWS_NEW_UI);
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
          original: { datasource_name_text: dsNameTxt, datasource_url: dsUrl },
        },
      }: any) => <a href={dsUrl}>{dsNameTxt}</a>,
      Header: t('Datasource'),
      accessor: 'datasource_name',
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
          original: { changed_on: changedOn },
        },
      }: any) => <span className="no-wrap">{moment(changedOn).fromNow()}</span>,
      Header: t('Last Modified'),
      accessor: 'changed_on',
      sortable: true,
    },
    {
      accessor: 'description',
      hidden: true,
    },
    {
      accessor: 'owners',
      hidden: true,
    },
    {
      accessor: 'datasource',
      hidden: true,
    },
    {
      Cell: ({ row: { state, original } }: any) => {
        const handleDelete = () => this.handleChartDelete(original);
        const openEditModal = () => this.openChartEditModal(original);
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
                onClick={openEditModal}
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

  openChartEditModal = (chart: Chart) => {
    this.setState({
      sliceCurrentlyEditing: {
        slice_id: chart.id,
        slice_name: chart.slice_name,
        description: chart.description,
        cache_timeout: chart.cache_timeout,
      },
    });
  };

  closeChartEditModal = () => {
    this.setState({ sliceCurrentlyEditing: null });
  };

  handleChartUpdated = (edits: Chart) => {
    // update the chart in our state with the edited info
    const newCharts = this.state.charts.map(chart =>
      chart.id === edits.id ? { ...chart, ...edits } : chart,
    );
    this.setState({
      charts: newCharts,
    });
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
        this.props.addSuccessToast(t('Deleted: %s', sliceName));
      },
      () => {
        this.props.addDangerToast(
          t('There was an issue deleting: %s', sliceName),
        );
      },
    );
  };

  handleBulkChartDelete = (charts: Chart[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/?q=!(${charts.map(({ id }) => id).join(',')})`,
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
            'There was an issue deleting the selected charts: %s',
            err.statusText,
          ),
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

    const filterExps = filters
      .map(({ id: col, operator: opr, value }) => ({
        col,
        opr,
        value,
      }))
      .reduce((acc, fltr) => {
        if (
          fltr.col === 'datasource' &&
          fltr.value &&
          typeof fltr.value === 'string'
        ) {
          const { datasource_id: dsId, datasource_type: dsType } = JSON.parse(
            fltr.value,
          );
          return [
            ...acc,
            { ...fltr, col: 'datasource_id', value: dsId },
            { ...fltr, col: 'datasource_type', value: dsType },
          ];
        }
        return [...acc, fltr];
      }, []);

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
      .catch(e => {
        console.log(e.body);
        this.props.addDangerToast(
          t('An error occurred while fetching charts: %s', e.statusText),
        );
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  createFetchResource = (
    resource: string,
    postProcess?: (value: []) => any[],
  ) => async () => {
    try {
      const { json = {} } = await SupersetClient.get({
        endpoint: resource,
      });
      return postProcess ? postProcess(json?.result) : json?.result;
    } catch (e) {
      this.props.addDangerToast(
        t('An error occurred while fetching chart filters: %s', e.statusText),
      );
    }
    return [];
  };

  convertOwners = (owners: any[]) =>
    owners.map(({ text: label, value }) => ({ label, value }));

  stringifyValues = (datasources: any[]) => {
    return datasources.map(ds => ({ ...ds, value: JSON.stringify(ds.value) }));
  };

  updateFilters = async () => {
    const { filterOperators } = this.state;
    const fetchOwners = this.createFetchResource(
      '/api/v1/chart/related/owners',
      this.convertOwners,
    );

    if (this.isNewUIEnabled) {
      this.setState({
        filters: [
          {
            Header: 'Owner',
            id: 'owners',
            input: 'select',
            operator: 'rel_m_m',
            unfilteredLabel: 'All',
            fetchSelects: fetchOwners,
          },
          {
            Header: 'Viz Type',
            id: 'viz_type',
            input: 'select',
            operator: 'eq',
            unfilteredLabel: 'All',
            selects: getChartMetadataRegistry()
              .keys()
              .map(k => ({ label: k, value: k })),
          },
          {
            Header: 'Dataset',
            id: 'datasource',
            input: 'select',
            operator: 'eq',
            unfilteredLabel: 'All',
            fetchSelects: this.createFetchResource(
              '/api/v1/chart/datasources',
              this.stringifyValues,
            ),
          },
          {
            Header: 'Search',
            id: 'slice_name',
            input: 'search',
            operator: 'name_or_description',
          },
        ],
      });
      return;
    }

    const convertFilter = ({
      name: label,
      operator,
    }: {
      name: string;
      operator: string;
    }) => ({ label, value: operator });

    const owners = await fetchOwners();
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
          selects: owners,
        },
      ],
    });
  };

  render() {
    const {
      charts,
      chartCount,
      loading,
      filters,
      sliceCurrentlyEditing,
    } = this.state;
    return (
      <div className="container welcome">
        <Panel>
          <Panel.Body>
            {sliceCurrentlyEditing && (
              <PropertiesModal
                show
                onHide={this.closeChartEditModal}
                onSave={this.handleChartUpdated}
                slice={sliceCurrentlyEditing}
              />
            )}
            <ConfirmStatusChange
              title={t('Please confirm')}
              description={t(
                'Are you sure you want to delete the selected charts?',
              )}
              onConfirm={this.handleBulkChartDelete}
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
                    useNewUIFilters={this.isNewUIEnabled}
                  />
                );
              }}
            </ConfirmStatusChange>
          </Panel.Body>
        </Panel>
      </div>
    );
  }
}

export default withToasts(ChartList);
