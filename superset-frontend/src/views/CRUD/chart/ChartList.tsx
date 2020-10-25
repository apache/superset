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
import { SupersetClient, getChartMetadataRegistry, t } from '@superset-ui/core';
import React, { useState, useMemo } from 'react';
import rison from 'rison';
import { uniqBy } from 'lodash';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import { useListViewResource, useFavoriteStatus } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import FacePile from 'src/components/FacePile';
import Icon from 'src/components/Icon';
import FaveStar from 'src/components/FaveStar';
import ListView, {
  ListViewProps,
  Filters,
  SelectOption,
} from 'src/components/ListView';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import Chart, { Slice } from 'src/types/Chart';
import ListViewCard from 'src/components/ListViewCard';
import Label from 'src/components/Label';
import { Dropdown, Menu } from 'src/common/components';
import TooltipWrapper from 'src/components/TooltipWrapper';

const PAGE_SIZE = 25;
const FAVESTAR_BASE_URL = '/superset/favstar/slice';

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

interface ChartListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function ChartList(props: ChartListProps) {
  const {
    state: {
      loading,
      resourceCount: chartCount,
      resourceCollection: charts,
      bulkSelectEnabled,
    },
    setResourceCollection: setCharts,
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<Chart>('chart', t('chart'), props.addDangerToast);
  const [favoriteStatusRef, fetchFaveStar, saveFaveStar] = useFavoriteStatus(
    {},
    FAVESTAR_BASE_URL,
    props.addDangerToast,
  );
  const [
    sliceCurrentlyEditing,
    setSliceCurrentlyEditing,
  ] = useState<Slice | null>(null);

  const canCreate = hasPerm('can_add');
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');
  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  function openChartEditModal(chart: Chart) {
    setSliceCurrentlyEditing({
      slice_id: chart.id,
      slice_name: chart.slice_name,
      description: chart.description,
      cache_timeout: chart.cache_timeout,
    });
  }

  function closeChartEditModal() {
    setSliceCurrentlyEditing(null);
  }

  function handleChartUpdated(edits: Chart) {
    // update the chart in our state with the edited info
    const newCharts = charts.map(chart =>
      chart.id === edits.id ? { ...chart, ...edits } : chart,
    );
    setCharts(newCharts);
  }

  function handleChartDelete({ id, slice_name: sliceName }: Chart) {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/${id}`,
    }).then(
      () => {
        refreshData();
        props.addSuccessToast(t('Deleted: %s', sliceName));
      },
      () => {
        props.addDangerToast(t('There was an issue deleting: %s', sliceName));
      },
    );
  }

  function handleBulkChartDelete(chartsToDelete: Chart[]) {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/?q=${rison.encode(
        chartsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        props.addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        props.addDangerToast(
          t('There was an issue deleting the selected charts: %s', errMsg),
        ),
      ),
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
        size: 'xxl',
      },
      {
        Cell: ({
          row: {
            original: {
              datasource_name_text: dsNameTxt,
              datasource_url: dsUrl,
            },
          },
        }: any) => <a href={dsUrl}>{dsNameTxt}</a>,
        Header: t('Dataset'),
        accessor: 'datasource_id',
        size: 'xl',
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
            original: { changed_on_delta_humanized: changedOn },
          },
        }: any) => <span className="no-wrap">{changedOn}</span>,
        Header: t('Last Modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        accessor: 'owners',
        hidden: true,
        disableSortBy: true,
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
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () => handleChartDelete(original);
          const openEditModal = () => openChartEditModal(original);

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
                        <Icon name="trash" />
                      </span>
                    </TooltipWrapper>
                  )}
                </ConfirmStatusChange>
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
                    onClick={openEditModal}
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
        hidden: !canEdit && !canDelete,
      },
    ],
    [canEdit, canDelete],
  );

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
              'An error occurred while fetching chart owners values: %s',
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
        'chart',
        'created_by',
        createErrorHandler(errMsg =>
          props.addDangerToast(
            t(
              'An error occurred while fetching chart created by values: %s',
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
      operator: 'chart_all_text',
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
                  data-test="chart-list-delete-option"
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
            data-test="chart-list-edit-option"
            role="button"
            tabIndex={0}
            onClick={() => openChartEditModal(chart)}
          >
            <ListViewCard.MenuIcon name="edit-alt" /> Edit
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <ListViewCard
        loading={chart.loading}
        title={chart.slice_name}
        url={bulkSelectEnabled ? undefined : chart.url}
        imgURL={chart.thumbnail_url ?? ''}
        imgFallbackURL="/static/assets/images/chart-card-fallback.png"
        imgPosition="bottom"
        description={t('Last modified %s', chart.changed_on_delta_humanized)}
        coverLeft={<FacePile users={chart.owners || []} />}
        coverRight={
          <Label bsStyle="secondary">{chart.datasource_name_text}</Label>
        }
        actions={
          <ListViewCard.Actions>
            {renderFaveStar(chart.id)}
            <Dropdown data-test="dropdown-options" overlay={menu}>
              <Icon name="more-horiz" />
            </Dropdown>
          </ListViewCard.Actions>
        }
      />
    );
  }
  const subMenuButtons: SubMenuProps['buttons'] = [];
  if (canDelete) {
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
          <i className="fa fa-plus" /> {t('Chart')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        window.location.assign('/chart/add');
      },
    });
  }
  return (
    <>
      <SubMenu name={t('Charts')} buttons={subMenuButtons} />
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
            <ListView<Chart>
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
              defaultViewMode={
                isFeatureEnabled(FeatureFlag.LISTVIEWS_DEFAULT_CARD_VIEW)
                  ? 'card'
                  : 'table'
              }
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(ChartList);
