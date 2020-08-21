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
import React, { useState, useCallback, useEffect } from 'react';
import rison from 'rison';
import { uniqBy } from 'lodash';
import {
  createFetchRelated,
  createErrorHandler,
  createFaveStarHandlers,
} from 'src/views/CRUD/utils';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu from 'src/components/Menu/SubMenu';
import AvatarIcon from 'src/components/AvatarIcon';
import Icon from 'src/components/Icon';
import FaveStar from 'src/components/FaveStar';
import ListView, {
  ListViewProps,
  FetchDataConfig,
  Filters,
  SelectOption,
} from 'src/components/ListView';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import PropertiesModal, { Slice } from 'src/explore/components/PropertiesModal';
import Chart from 'src/types/Chart';
import ListViewCard from 'src/components/ListViewCard';
import Label from 'src/components/Label';
import { Dropdown, Menu } from 'src/common/components';

const PAGE_SIZE = 25;
const FAVESTAR_BASE_URL = '/superset/favstar/slice';

interface ChartListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

interface State {
  bulkSelectEnabled: boolean;
  chartCount: number;
  charts: Chart[];
  favoriteStatus: object;
  lastFetchDataConfig: FetchDataConfig | null;
  loading: boolean;
  permissions: string[];
  // for now we need to use the Slice type defined in PropertiesModal.
  // In future it would be better to have a unified Chart entity.
  sliceCurrentlyEditing: Slice | null;
}
const createFetchDatasets = (handleError: (err: Response) => void) => async (
  filterValue = '',
  pageIndex?: number,
  pageSize?: number,
) => {
  // add filters if filterValue
  const filters = filterValue
    ? { filters: [{ col: 'table_name', opr: 'sw', value: filterValue }] }
    : {};
  try {
    const queryParams = rison.encode({
      columns: ['datasource_name', 'datasource_id'],
      keys: ['none'],
      order_by: 'datasource_name',
      ...(pageIndex ? { page: pageIndex } : {}),
      ...(pageSize ? { page_size: pageSize } : {}),
      ...filters,
    });

    const { json = {} } = await SupersetClient.get({
      endpoint: `/api/v1/dataset/?q=${queryParams}`,
    });

    const datasets = json?.result?.map(
      ({ table_name: tableName, id }: { table_name: string; id: number }) => ({
        label: tableName,
        value: id,
      }),
    );

    return uniqBy<SelectOption>(datasets, 'value');
  } catch (e) {
    handleError(e);
  }
  return [];
};
function ChartList(props: ChartListProps) {
  const [state, setState] = useState<State>({
    bulkSelectEnabled: false,
    chartCount: 0,
    charts: [],
    favoriteStatus: {}, // Hash mapping dashboard id to 'isStarred' status
    lastFetchDataConfig: null,
    loading: true,
    permissions: [],
    sliceCurrentlyEditing: null,
  });

  function updateState(update: Partial<State>) {
    setState({ ...state, ...update });
  }

  useEffect(() => {
    SupersetClient.get({
      endpoint: `/api/v1/chart/_info`,
    }).then(
      ({ json: infoJson = {} }) => {
        updateState({
          permissions: infoJson.permissions,
        });
      },
      createErrorHandler(errMsg =>
        props.addDangerToast(
          t('An error occurred while fetching chart info: %s', errMsg),
        ),
      ),
    );
  }, []);

  function hasPerm(perm: string) {
    if (!state.permissions.length) {
      return false;
    }

    return Boolean(state.permissions.find(p => p === perm));
  }

  const canEdit = hasPerm('can_edit');

  const canDelete = hasPerm('can_delete');

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  const fetchFaveStarMethods = createFaveStarHandlers(
    FAVESTAR_BASE_URL,
    {
      state,
      setState: updateState,
    },
    (message: string) => {
      props.addDangerToast(message);
    },
  );

  const fetchData = useCallback(
    ({
      pageIndex,
      pageSize,
      sortBy,
      filters: filterValues,
    }: FetchDataConfig) => {
      // set loading state, cache the last config for fetching data in this component.
      updateState({
        lastFetchDataConfig: {
          filters: filterValues,
          pageIndex,
          pageSize,
          sortBy,
        },
        loading: true,
      });

      const filterExps = filterValues.map(
        ({ id: col, operator: opr, value }) => ({
          col,
          opr,
          value,
        }),
      );

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
            updateState({ charts: json.result, chartCount: json.count });
          },
          createErrorHandler(errMsg =>
            props.addDangerToast(
              t('An error occurred while fetching charts: %s', errMsg),
            ),
          ),
        )
        .finally(() => {
          updateState({ loading: false });
        });
    },
    [],
  );

  function toggleBulkSelect() {
    updateState({ bulkSelectEnabled: !state.bulkSelectEnabled });
  }

  function openChartEditModal(chart: Chart) {
    updateState({
      sliceCurrentlyEditing: {
        slice_id: chart.id,
        slice_name: chart.slice_name,
        description: chart.description,
        cache_timeout: chart.cache_timeout,
      },
    });
  }

  function closeChartEditModal() {
    updateState({ sliceCurrentlyEditing: null });
  }

  function handleChartUpdated(edits: Chart) {
    // update the chart in our state with the edited info
    const newCharts = state.charts.map(chart =>
      chart.id === edits.id ? { ...chart, ...edits } : chart,
    );
    updateState({
      charts: newCharts,
    });
  }

  function handleChartDelete({ id, slice_name: sliceName }: Chart) {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/${id}`,
    }).then(
      () => {
        const { lastFetchDataConfig } = state;
        if (lastFetchDataConfig) {
          fetchData(lastFetchDataConfig);
        }
        props.addSuccessToast(t('Deleted: %s', sliceName));
      },
      () => {
        props.addDangerToast(t('There was an issue deleting: %s', sliceName));
      },
    );
  }

  function handleBulkChartDelete(charts: Chart[]) {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/?q=${rison.encode(charts.map(({ id }) => id))}`,
    }).then(
      ({ json = {} }) => {
        const { lastFetchDataConfig } = state;
        if (lastFetchDataConfig) {
          fetchData(lastFetchDataConfig);
        }
        props.addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        props.addDangerToast(
          t('There was an issue deleting the selected charts: %s', errMsg),
        ),
      ),
    );
  }

  const columns = [
    {
      Cell: ({ row: { original } }: any) => {
        return (
          <FaveStar
            itemId={original.id}
            fetchFaveStar={fetchFaveStarMethods.fetchFaveStar}
            saveFaveStar={fetchFaveStarMethods.saveFaveStar}
            isStarred={!!state.favoriteStatus[original.id]}
            height={20}
          />
        );
      },
      Header: '',
      id: 'favorite',
      disableSortBy: true,
    },
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
      accessor: 'datasource_id',
      hidden: true,
      disableSortBy: true,
    },
    {
      Cell: ({ row: { original } }: any) => {
        const handleDelete = () => handleChartDelete(original);
        const openEditModal = () => openChartEditModal(original);
        if (!canEdit && !canDelete) {
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
            {canEdit && (
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

  const filters: Filters = [
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
          props.addDangerToast(
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
      Header: t('Datasource'),
      id: 'datasource_id',
      input: 'select',
      operator: 'eq',
      unfilteredLabel: 'All',
      fetchSelects: createFetchDatasets(
        createErrorHandler(errMsg =>
          props.addDangerToast(
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

  const sortTypes = [
    {
      desc: false,
      id: 'slice_name',
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

  function renderCard(chart: Chart & { loading: boolean }) {
    const menu = (
      <Menu>
        {canDelete && (
          <Menu.Item>
            <ConfirmStatusChange
              title={t('Please Confirm')}
              description={
                <>
                  {t('Are you sure you want to delete')}{' '}
                  <b>{chart.slice_name}</b>?
                </>
              }
              onConfirm={() => handleChartDelete(chart)}
            >
              {confirmDelete => (
                <div
                  role="button"
                  tabIndex={0}
                  className="action-button"
                  onClick={confirmDelete}
                >
                  <ListViewCard.MenuIcon name="trash" /> Delete
                </div>
              )}
            </ConfirmStatusChange>
          </Menu.Item>
        )}
        {canEdit && (
          <Menu.Item
            role="button"
            tabIndex={0}
            onClick={() => openChartEditModal(chart)}
          >
            <ListViewCard.MenuIcon name="pencil" /> Edit
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <ListViewCard
        loading={chart.loading}
        title={chart.slice_name}
        url={state.bulkSelectEnabled ? undefined : chart.url}
        imgURL={chart.thumbnail_url ?? ''}
        imgFallbackURL={'/static/assets/images/chart-card-fallback.png'}
        description={t('Last modified %s', chart.changed_on_delta_humanized)}
        coverLeft={(chart.owners || []).slice(0, 5).map(owner => (
          <AvatarIcon
            key={owner.id}
            uniqueKey={`${owner.username}-${chart.id}`}
            firstName={owner.first_name}
            lastName={owner.last_name}
            iconSize={24}
            textSize={9}
          />
        ))}
        coverRight={
          <Label bsStyle="secondary">{chart.datasource_name_text}</Label>
        }
        actions={
          <ListViewCard.Actions>
            <FaveStar
              itemId={chart.id}
              fetchFaveStar={fetchFaveStarMethods.fetchFaveStar}
              saveFaveStar={fetchFaveStarMethods.saveFaveStar}
              isStarred={!!state.favoriteStatus[chart.id]}
              width={20}
              height={20}
            />
            <Dropdown overlay={menu}>
              <Icon name="more" />
            </Dropdown>
          </ListViewCard.Actions>
        }
      />
    );
  }

  const {
    bulkSelectEnabled,
    charts,
    chartCount,
    loading,
    sliceCurrentlyEditing,
  } = state;

  return (
    <>
      <SubMenu
        name={t('Charts')}
        secondaryButton={
          canDelete
            ? {
                name: t('Bulk Select'),
                onClick: toggleBulkSelect,
              }
            : undefined
        }
      />
      {sliceCurrentlyEditing && (
        <PropertiesModal
          onHide={closeChartEditModal}
          onSave={handleChartUpdated}
          show
          slice={sliceCurrentlyEditing}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected charts?')}
        onConfirm={handleBulkChartDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = canDelete
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
              cardSortSelectOptions={sortTypes}
              className="chart-list-view"
              columns={columns}
              count={chartCount}
              data={charts}
              disableBulkSelect={toggleBulkSelect}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              renderCard={renderCard}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(ChartList);
