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
import { SupersetClient, t } from '@superset-ui/core';
import React, {
  FunctionComponent,
  useState,
  useMemo,
  useCallback,
} from 'react';
import rison from 'rison';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
} from 'src/views/CRUD/utils';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DatasourceModal from 'src/datasource/DatasourceModal';
import DeleteModal from 'src/components/DeleteModal';
import ListView, { ListViewProps, Filters } from 'src/components/ListView';
import SubMenu, {
  SubMenuProps,
  ButtonProps,
} from 'src/components/Menu/SubMenu';
import { commonMenuData } from 'src/views/CRUD/data/common';
import Owner from 'src/types/Owner';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import TooltipWrapper from 'src/components/TooltipWrapper';
import Icon from 'src/components/Icon';
import FacePile from 'src/components/FacePile';
import AddDatasetModal from './AddDatasetModal';

const PAGE_SIZE = 25;

type Dataset = {
  changed_by_name: string;
  changed_by_url: string;
  changed_by: string;
  changed_on_delta_humanized: string;
  database: {
    id: string;
    database_name: string;
  };
  kind: string;
  explore_url: string;
  id: number;
  owners: Array<Owner>;
  schema: string;
  table_name: string;
};

interface DatasetListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const DatasetList: FunctionComponent<DatasetListProps> = ({
  addDangerToast,
  addSuccessToast,
}) => {
  const {
    state: {
      loading,
      resourceCount: datasetCount,
      resourceCollection: datasets,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<Dataset>('dataset', t('dataset'), addDangerToast);

  const [datasetAddModalOpen, setDatasetAddModalOpen] = useState<boolean>(
    false,
  );

  const [datasetCurrentlyDeleting, setDatasetCurrentlyDeleting] = useState<
    (Dataset & { chart_count: number; dashboard_count: number }) | null
  >(null);

  const [
    datasetCurrentlyEditing,
    setDatasetCurrentlyEditing,
  ] = useState<Dataset | null>(null);

  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');
  const canCreate = hasPerm('can_add');

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  const openDatasetEditModal = useCallback(
    ({ id }: Dataset) => {
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${id}`,
      })
        .then(({ json = {} }) => {
          const owners = json.result.owners.map((owner: any) => owner.id);
          setDatasetCurrentlyEditing({ ...json.result, owners });
        })
        .catch(() => {
          addDangerToast(
            t('An error occurred while fetching dataset related data'),
          );
        });
    },
    [addDangerToast],
  );

  const openDatasetDeleteModal = (dataset: Dataset) =>
    SupersetClient.get({
      endpoint: `/api/v1/dataset/${dataset.id}/related_objects`,
    })
      .then(({ json = {} }) => {
        setDatasetCurrentlyDeleting({
          ...dataset,
          chart_count: json.charts.count,
          dashboard_count: json.dashboards.count,
        });
      })
      .catch(
        createErrorHandler(errMsg =>
          t(
            'An error occurred while fetching dataset related data: %s',
            errMsg,
          ),
        ),
      );

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { kind },
          },
        }: any) => {
          if (kind === 'physical')
            return (
              <TooltipWrapper
                label="physical-dataset"
                tooltip={t('Physical Dataset')}
              >
                <Icon name="dataset-physical" />
              </TooltipWrapper>
            );

          return (
            <TooltipWrapper
              label="virtual-dataset"
              tooltip={t('Virtual Dataset')}
            >
              <Icon name="dataset-virtual" />
            </TooltipWrapper>
          );
        },
        accessor: 'kind_icon',
        disableSortBy: true,
        size: 'xs',
      },
      {
        Cell: ({
          row: {
            original: { table_name: datasetTitle, explore_url: exploreURL },
          },
        }: any) => <a href={exploreURL}>{datasetTitle}</a>,
        Header: t('Name'),
        accessor: 'table_name',
      },
      {
        Cell: ({
          row: {
            original: { kind },
          },
        }: any) => kind[0]?.toUpperCase() + kind.slice(1),
        Header: t('Type'),
        accessor: 'kind',
        disableSortBy: true,
        size: 'md',
      },
      {
        Header: t('Source'),
        accessor: 'database.database_name',
        size: 'lg',
      },
      {
        Header: t('Schema'),
        accessor: 'schema',
        size: 'lg',
      },
      {
        Cell: ({
          row: {
            original: { changed_on_delta_humanized: changedOn },
          },
        }: any) => <span className="no-wrap">{changedOn}</span>,
        Header: t('Modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { changed_by_name: changedByName },
          },
        }: any) => changedByName,
        Header: t('Modified By'),
        accessor: 'changed_by.first_name',
        size: 'xl',
      },
      {
        accessor: 'database',
        disableSortBy: true,
        hidden: true,
      },
      {
        Cell: ({
          row: {
            original: { owners = [], table_name: tableName },
          },
        }: any) => <FacePile users={owners} />,
        Header: t('Owners'),
        id: 'owners',
        disableSortBy: true,
        size: 'lg',
      },
      {
        accessor: 'is_sqllab_view',
        hidden: true,
        disableSortBy: true,
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => openDatasetEditModal(original);
          const handleDelete = () => openDatasetDeleteModal(original);
          if (!canEdit && !canDelete) {
            return null;
          }
          return (
            <span className="actions">
              {canDelete && (
                <TooltipWrapper
                  label="delete-action"
                  tooltip={t('Delete')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleDelete}
                  >
                    <Icon name="trash" />
                  </span>
                </TooltipWrapper>
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
                    onClick={handleEdit}
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
      },
    ],
    [canEdit, canDelete, openDatasetEditModal],
  );

  const filterTypes: Filters = useMemo(
    () => [
      {
        Header: t('Owner'),
        id: 'owners',
        input: 'select',
        operator: 'rel_m_m',
        unfilteredLabel: 'All',
        fetchSelects: createFetchRelated(
          'dataset',
          'owners',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset owner values: %s',
              errMsg,
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Database'),
        id: 'database',
        input: 'select',
        operator: 'rel_o_m',
        unfilteredLabel: 'All',
        fetchSelects: createFetchRelated(
          'dataset',
          'database',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching datasets: %s', errMsg),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Schema'),
        id: 'schema',
        input: 'select',
        operator: 'eq',
        unfilteredLabel: 'All',
        fetchSelects: createFetchDistinct(
          'dataset',
          'schema',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching schema values: %s', errMsg),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Type'),
        id: 'is_sqllab_view',
        input: 'select',
        operator: 'eq',
        unfilteredLabel: 'All',
        selects: [
          { label: 'Virtual', value: true },
          { label: 'Physical', value: false },
        ],
      },
      {
        Header: t('Search'),
        id: 'table_name',
        input: 'search',
        operator: 'ct',
      },
    ],
    [],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Datasets',
    ...commonMenuData,
  };

  const buttonArr: Array<ButtonProps> = [];

  if (canDelete) {
    buttonArr.push({
      name: t('Bulk Select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  if (canCreate) {
    buttonArr.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Dataset')}{' '}
        </>
      ),
      onClick: () => setDatasetAddModalOpen(true),
      buttonStyle: 'primary',
    });
  }

  menuData.buttons = buttonArr;

  const closeDatasetDeleteModal = () => {
    setDatasetCurrentlyDeleting(null);
  };

  const closeDatasetEditModal = () => {
    setDatasetCurrentlyEditing(null);
  };

  const handleDatasetDelete = ({ id, table_name: tableName }: Dataset) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/${id}`,
    }).then(
      () => {
        refreshData();
        setDatasetCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', tableName));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', tableName, errMsg),
        ),
      ),
    );
  };

  const handleBulkDatasetDelete = (datasetsToDelete: Dataset[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/?q=${rison.encode(
        datasetsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected datasets: %s', errMsg),
        ),
      ),
    );
  };

  return (
    <>
      <SubMenu {...menuData} />
      <AddDatasetModal
        show={datasetAddModalOpen}
        onHide={() => setDatasetAddModalOpen(false)}
        onDatasetAdd={refreshData}
      />
      {datasetCurrentlyDeleting && (
        <DeleteModal
          description={t(
            'The dataset %s is linked to %s charts that appear on %s dashboards. Are you sure you want to continue? Deleting the dataset will break those objects.',
            datasetCurrentlyDeleting.table_name,
            datasetCurrentlyDeleting.chart_count,
            datasetCurrentlyDeleting.dashboard_count,
          )}
          onConfirm={() => {
            if (datasetCurrentlyDeleting) {
              handleDatasetDelete(datasetCurrentlyDeleting);
            }
          }}
          onHide={closeDatasetDeleteModal}
          open
          title={t('Delete Dataset?')}
        />
      )}
      {datasetCurrentlyEditing && (
        <DatasourceModal
          datasource={datasetCurrentlyEditing}
          onDatasourceSave={refreshData}
          onHide={closeDatasetEditModal}
          show
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected datasets?',
        )}
        onConfirm={handleBulkDatasetDelete}
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
            <ListView<Dataset>
              className="dataset-list-view"
              columns={columns}
              data={datasets}
              count={datasetCount}
              pageSize={PAGE_SIZE}
              fetchData={fetchData}
              filters={filterTypes}
              loading={loading}
              initialSort={initialSort}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              renderBulkSelectCopy={selected => {
                const { virtualCount, physicalCount } = selected.reduce(
                  (acc, e) => {
                    if (e.original.kind === 'physical') acc.physicalCount += 1;
                    else if (e.original.kind === 'virtual')
                      acc.virtualCount += 1;
                    return acc;
                  },
                  { virtualCount: 0, physicalCount: 0 },
                );

                if (!selected.length) {
                  return t('0 Selected');
                }
                if (virtualCount && !physicalCount) {
                  return t(
                    '%s Selected (Virtual)',
                    selected.length,
                    virtualCount,
                  );
                }
                if (physicalCount && !virtualCount) {
                  return t(
                    '%s Selected (Physical)',
                    selected.length,
                    physicalCount,
                  );
                }

                return t(
                  '%s Selected (%s Physical, %s Virtual)',
                  selected.length,
                  physicalCount,
                  virtualCount,
                );
              }}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
};

export default withToasts(DatasetList);
