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
import PropTypes from 'prop-types';
import React from 'react';
import rison from 'rison';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu from 'src/components/Menu/SubMenu';
import Icon from 'src/components/Icon';
import ListView, { ListViewProps } from 'src/components/ListView/ListView';
import { FetchDataConfig, Filters } from 'src/components/ListView/types';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import PropertiesModal, { Slice } from 'src/explore/components/PropertiesModal';
import Chart from 'src/types/Chart';

const PAGE_SIZE = 25;

interface Props {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

interface State {
  bulkSelectEnabled: boolean;
  chartCount: number;
  charts: any[];
  lastFetchDataConfig: FetchDataConfig | null;
  loading: boolean;
  permissions: string[];
  // for now we need to use the Slice type defined in PropertiesModal.
  // In future it would be better to have a unified Chart entity.
  sliceCurrentlyEditing: Slice | null;
}
const createFetchDatasets = (
  handleError: (err: Response) => void,
) => async () => {
  try {
    const { json = {} } = await SupersetClient.get({
      endpoint: '/api/v1/chart/datasources',
    });

    return json?.result?.map((ds: { label: string; value: any }) => ({
      ...ds,
      value: JSON.stringify(ds.value),
    }));
  } catch (e) {
    handleError(e);
  }
  return [];
};
class ChartList extends React.PureComponent<Props, State> {
  static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
  };

  state: State = {
    bulkSelectEnabled: false,
    chartCount: 0,
    charts: [],
    lastFetchDataConfig: null,
    loading: true,
    permissions: [],
    sliceCurrentlyEditing: null,
  };

  componentDidMount() {
    SupersetClient.get({
      endpoint: `/api/v1/chart/_info`,
    }).then(
      ({ json: infoJson = {} }) => {
        this.setState({
          permissions: infoJson.permissions,
        });
      },
      createErrorHandler(errMsg =>
        this.props.addDangerToast(
          t('An error occurred while fetching chart info: %s', errMsg),
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

  initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  columns = [
    {
      Cell: ({
        row: {
          original: { url, slice_name: sliceName },
        },
      }: any) => <a href={url}>{sliceName}</a>,
      Header: t('Chart'),
      accessor: 'slice_name',
    },
    {
      Cell: ({
        row: {
          original: { viz_type: vizType },
        },
      }: any) => vizType,
      Header: t('Visualization Type'),
      accessor: 'viz_type',
    },
    {
      Cell: ({
        row: {
          original: { datasource_name_text: dsNameTxt, datasource_url: dsUrl },
        },
      }: any) => <a href={dsUrl}>{dsNameTxt}</a>,
      Header: t('Datasource'),
      accessor: 'datasource_name',
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
          original: { changed_on_delta_humanized: changedOn },
        },
      }: any) => <span className="no-wrap">{changedOn}</span>,
      Header: t('Last Modified'),
      accessor: 'changed_on_delta_humanized',
    },
    {
      accessor: 'description',
      hidden: true,
      disableSortBy: true,
    },
    {
      accessor: 'owners',
      hidden: true,
      disableSortBy: true,
    },
    {
      accessor: 'datasource',
      hidden: true,
      disableSortBy: true,
    },
    {
      Cell: ({ row: { original } }: any) => {
        const handleDelete = () => this.handleChartDelete(original);
        const openEditModal = () => this.openChartEditModal(original);
        if (!this.canEdit && !this.canDelete) {
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
                    <Icon name="trash" />
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

  filters: Filters = [
    {
      Header: t('Owner'),
      id: 'owners',
      input: 'select',
      operator: 'rel_m_m',
      unfilteredLabel: 'All',
      fetchSelects: createFetchRelated(
        'chart',
        'owners',
        createErrorHandler(errMsg =>
          this.props.addDangerToast(
            t(
              'An error occurred while fetching chart dataset values: %s',
              errMsg,
            ),
          ),
        ),
      ),
      paginate: true,
    },
    {
      Header: t('Viz Type'),
      id: 'viz_type',
      input: 'select',
      operator: 'eq',
      unfilteredLabel: 'All',
      selects: getChartMetadataRegistry()
        .keys()
        .map(k => ({ label: k, value: k })),
    },
    {
      Header: t('Dataset'),
      id: 'datasource',
      input: 'select',
      operator: 'eq',
      unfilteredLabel: 'All',
      fetchSelects: createFetchDatasets(
        createErrorHandler(errMsg =>
          this.props.addDangerToast(
            t(
              'An error occurred while fetching chart dataset values: %s',
              errMsg,
            ),
          ),
        ),
      ),
      paginate: false,
    },
    {
      Header: t('Search'),
      id: 'slice_name',
      input: 'search',
      operator: 'name_or_description',
    },
  ];

  hasPerm = (perm: string) => {
    if (!this.state.permissions.length) {
      return false;
    }

    return this.state.permissions.some(p => p === perm);
  };

  toggleBulkSelect = () => {
    this.setState({ bulkSelectEnabled: !this.state.bulkSelectEnabled });
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
      endpoint: `/api/v1/chart/?q=${rison.encode(charts.map(({ id }) => id))}`,
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
          t('There was an issue deleting the selected charts: %s', errMsg),
        ),
      ),
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

    const queryParams = rison.encode({
      order_column: sortBy[0].id,
      order_direction: sortBy[0].desc ? 'desc' : 'asc',
      page: pageIndex,
      page_size: pageSize,
      ...(filterExps.length ? { filters: filterExps } : {}),
    });

    return SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${queryParams}`,
    })
      .then(
        ({ json = {} }) => {
          this.setState({ charts: json.result, chartCount: json.count });
        },
        createErrorHandler(errMsg =>
          this.props.addDangerToast(
            t('An error occurred while fetching charts: %s', errMsg),
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
      charts,
      chartCount,
      loading,
      sliceCurrentlyEditing,
    } = this.state;
    return (
      <>
        <SubMenu
          name={t('Charts')}
          secondaryButton={
            this.canDelete
              ? {
                  name: t('Bulk Select'),
                  onClick: this.toggleBulkSelect,
                }
              : undefined
          }
        />
        {sliceCurrentlyEditing && (
          <PropertiesModal
            onHide={this.closeChartEditModal}
            onSave={this.handleChartUpdated}
            show
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
            const bulkActions: ListViewProps['bulkActions'] = this.canDelete
              ? [
                  {
                    key: 'delete',
                    name: t('Delete'),
                    onSelect: confirmDelete,
                    type: 'danger',
                  },
                ]
              : [];

            return (
              <ListView
                bulkActions={bulkActions}
                bulkSelectEnabled={bulkSelectEnabled}
                className="chart-list-view"
                columns={this.columns}
                count={chartCount}
                data={charts}
                disableBulkSelect={this.toggleBulkSelect}
                fetchData={this.fetchData}
                filters={this.filters}
                initialSort={this.initialSort}
                loading={loading}
                pageSize={PAGE_SIZE}
              />
            );
          }}
        </ConfirmStatusChange>
      </>
    );
  }
}

export default withToasts(ChartList);
