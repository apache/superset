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
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import rison from 'rison';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DatasourceModal from 'src/datasource/DatasourceModal';
import DeleteModal from 'src/components/DeleteModal';
import ListView, { ListViewProps } from 'src/components/ListView/ListView';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import AvatarIcon from 'src/components/AvatarIcon';
import { FetchDataConfig, Filters } from 'src/components/ListView/types';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import TooltipWrapper from 'src/components/TooltipWrapper';
import Icon from 'src/components/Icon';
import AddDatasetModal from './AddDatasetModal';

const PAGE_SIZE = 25;

type Owner = {
  first_name: string;
  id: string;
  last_name: string;
  username: string;
};

type Dataset = {
  changed_by_name: string;
  changed_by_url: string;
  changed_by: string;
  changed_on_delta_humanized: string;
  database: {
    id: string;
    database_name: string;
  };
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
interface Database {
  allow_csv_upload: boolean;
  allow_ctas: boolean;
  allow_cvas: null | boolean;
  allow_dml: boolean;
  allow_multi_schema_metadata_fetch: boolean;
  allow_run_async: boolean;
  allows_cost_estimate: boolean;
  allows_subquery: boolean;
  allows_virtual_table_explore: boolean;
  backend: string;
  database_name: string;
  explore_database_id: number;
  expose_in_sqllab: boolean;
  force_ctas_schema: null | boolean;
  function_names: string[];
  id: number;
}

const createFetchDatabases = (handleError: (err: Response) => void) => async (
  filterValue = '',
  pageIndex?: number,
  pageSize?: number,
) => {
  try {
    const queryParams = rison.encode({
      columns: ['database_name', 'id'],
      keys: ['none'],
      ...(pageIndex ? { page: pageIndex } : {}),
      ...(pageSize ? { page_size: pageSize } : {}),
      ...(filterValue ? { filter: filterValue } : {}),
    });
    const { json = {} } = await SupersetClient.get({
      endpoint: `/api/v1/database/?q=${queryParams}`,
    });

    return json?.result?.map(
      ({ database_name: label, id: value }: Database) => ({
        label,
        value,
      }),
    );
  } catch (e) {
    handleError(e);
  }
  return [];
};

export const createFetchSchemas = (
  handleError: (error: Response) => void,
) => async (filterValue = '', pageIndex?: number, pageSize?: number) => {
  try {
    const queryParams = rison.encode({
      ...(pageIndex ? { page: pageIndex } : {}),
      ...(pageSize ? { page_size: pageSize } : {}),
      ...(filterValue ? { filter: filterValue } : {}),
    });
    const { json = {} } = await SupersetClient.get({
      endpoint: `/api/v1/database/schemas/?q=${queryParams}`,
    });

    return json?.result?.map(
      ({ text: label, value }: { text: string; value: any }) => ({
        label,
        value,
      }),
    );
  } catch (e) {
    handleError(e);
  }
  return [];
};
const DatasetList: FunctionComponent<DatasetListProps> = ({
  addDangerToast,
  addSuccessToast,
}) => {
  const [datasetCount, setDatasetCount] = useState(0);
  const [datasetCurrentlyDeleting, setDatasetCurrentlyDeleting] = useState<
    (Dataset & { chart_count: number; dashboard_count: number }) | null
  >(null);
  const [
    datasetCurrentlyEditing,
    setDatasetCurrentlyEditing,
  ] = useState<Dataset | null>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [
    lastFetchDataConfig,
    setLastFetchDataConfig,
  ] = useState<FetchDataConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [datasetAddModalOpen, setDatasetAddModalOpen] = useState<boolean>(
    false,
  );
  const [bulkSelectEnabled, setBulkSelectEnabled] = useState<boolean>(false);

  const filterTypes: Filters = [
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
      Header: t('Datasource'),
      id: 'database',
      input: 'select',
      operator: 'rel_o_m',
      unfilteredLabel: 'All',
      fetchSelects: createFetchDatabases(
        createErrorHandler(errMsg =>
          t('An error occurred while fetching datasource values: %s', errMsg),
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
      fetchSelects: createFetchSchemas(errMsg =>
        t('An error occurred while fetching schema values: %s', errMsg),
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
  ];

  const fetchDatasetInfo = () => {
    SupersetClient.get({
      endpoint: `/api/v1/dataset/_info`,
    }).then(
      ({ json: infoJson = {} }) => {
        setPermissions(infoJson.permissions);
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('An error occurred while fetching datasets', errMsg)),
      ),
    );
  };

  useEffect(() => {
    fetchDatasetInfo();
  }, []);

  const hasPerm = (perm: string) => {
    if (!permissions.length) {
      return false;
    }

    return Boolean(permissions.find(p => p === perm));
  };

  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');
  const canCreate = hasPerm('can_add');

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  const openDatasetEditModal = ({ id }: Dataset) => {
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
  };

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

  const columns = [
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
          original: { table_name: datasetTitle },
        },
      }: any) => datasetTitle,
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
          original: { owners, table_name: tableName },
        },
      }: any) => {
        if (!owners) {
          return null;
        }
        return owners
          .slice(0, 5)
          .map((owner: Owner) => (
            <AvatarIcon
              key={owner.id}
              tableName={tableName}
              firstName={owner.first_name}
              lastName={owner.last_name}
              userName={owner.username}
              iconSize={24}
              textSize={9}
            />
          ));
      },
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
      Cell: ({ row: { state, original } }: any) => {
        const handleEdit = () => openDatasetEditModal(original);
        const handleDelete = () => openDatasetDeleteModal(original);
        if (!canEdit && !canDelete) {
          return null;
        }
        return (
          <span className="actions">
            <TooltipWrapper
              label="explore-action"
              tooltip={t('Explore')}
              placement="bottom"
            >
              <a
                role="button"
                tabIndex={0}
                className="action-button"
                href={original.explore_url}
              >
                <Icon name="compass" />
              </a>
            </TooltipWrapper>
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
                  <Icon name="pencil" />
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
  ];

  const menuData: SubMenuProps = {
    activeChild: 'Datasets',
    name: t('Data'),
    children: [
      {
        name: 'Datasets',
        label: t('Datasets'),
        url: '/tablemodelview/list/',
      },
      { name: 'Databases', label: t('Databases'), url: '/databaseview/list/' },
      {
        name: 'Saved Queries',
        label: t('Saved Queries'),
        url: '/sqllab/my_queries/',
      },
    ],
  };

  if (canCreate) {
    menuData.primaryButton = {
      name: (
        <>
          {' '}
          <i className="fa fa-plus" /> {t('Dataset')}{' '}
        </>
      ),
      onClick: () => setDatasetAddModalOpen(true),
    };
  }

  if (canDelete) {
    menuData.secondaryButton = {
      name: t('Bulk Select'),
      onClick: () => setBulkSelectEnabled(!bulkSelectEnabled),
    };
  }

  const closeDatasetDeleteModal = () => {
    setDatasetCurrentlyDeleting(null);
  };

  const closeDatasetEditModal = () => setDatasetCurrentlyEditing(null);

  const fetchData = useCallback(
    ({ pageIndex, pageSize, sortBy, filters }: FetchDataConfig) => {
      // set loading state, cache the last config for fetching data in this component.
      setLoading(true);
      setLastFetchDataConfig({
        filters,
        pageIndex,
        pageSize,
        sortBy,
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
        endpoint: `/api/v1/dataset/?q=${queryParams}`,
      })
        .then(
          ({ json }) => {
            setLoading(false);
            setDatasets(json.result);
            setDatasetCount(json.count);
          },
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching datasets: %s', errMsg),
            ),
          ),
        )
        .finally(() => setLoading(false));
    },
    [],
  );

  const handleDatasetDelete = ({ id, table_name: tableName }: Dataset) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/${id}`,
    }).then(
      () => {
        if (lastFetchDataConfig) {
          fetchData(lastFetchDataConfig);
        }
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

  const handleBulkDatasetDelete = () => {
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/?q=${rison.encode(
        datasets.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        if (lastFetchDataConfig) {
          fetchData(lastFetchDataConfig);
        }
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected datasets: %s', errMsg),
        ),
      ),
    );
  };

  const handleUpdateDataset = () => {
    if (lastFetchDataConfig) {
      fetchData(lastFetchDataConfig);
    }
  };

  return (
    <>
      <SubMenu {...menuData} />
      <AddDatasetModal
        show={datasetAddModalOpen}
        onHide={() => setDatasetAddModalOpen(false)}
        onDatasetAdd={() => {
          if (lastFetchDataConfig) fetchData(lastFetchDataConfig);
        }}
      />
      {datasetCurrentlyDeleting && (
        <DeleteModal
          description={t(
            'The dataset %s is linked to %s charts that appear on %s dashboards. Are you sure you want to continue? Deleting the dataset will break those objects.',
            datasetCurrentlyDeleting.table_name,
            datasetCurrentlyDeleting.chart_count,
            datasetCurrentlyDeleting.dashboard_count,
          )}
          onConfirm={() => handleDatasetDelete(datasetCurrentlyDeleting)}
          onHide={closeDatasetDeleteModal}
          open
          title={t('Delete Dataset?')}
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
            <>
              {datasetCurrentlyDeleting && (
                <DeleteModal
                  description={t(
                    `The dataset ${datasetCurrentlyDeleting.table_name} is linked to 
                  ${datasetCurrentlyDeleting.chart_count} charts that appear on 
                  ${datasetCurrentlyDeleting.dashboard_count} dashboards. 
                  Are you sure you want to continue? Deleting the dataset will break 
                  those objects.`,
                  )}
                  onConfirm={() =>
                    handleDatasetDelete(datasetCurrentlyDeleting)
                  }
                  onHide={closeDatasetDeleteModal}
                  open
                  title={t('Delete Dataset?')}
                />
              )}
              {datasetCurrentlyEditing && (
                <DatasourceModal
                  datasource={datasetCurrentlyEditing}
                  onDatasourceSave={handleUpdateDataset}
                  onHide={closeDatasetEditModal}
                  show
                />
              )}
              <ListView
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
                disableBulkSelect={() => setBulkSelectEnabled(false)}
                renderBulkSelectCopy={selected => {
                  const { virtualCount, physicalCount } = selected.reduce(
                    (acc, e) => {
                      if (e.original.kind === 'physical')
                        acc.physicalCount += 1;
                      else if (e.original.kind === 'virtual')
                        acc.virtualCount += 1;
                      return acc;
                    },
                    { virtualCount: 0, physicalCount: 0 },
                  );

                  if (!selected.length) {
                    return t('0 Selected');
                  } else if (virtualCount && !physicalCount) {
                    return t(
                      '%s Selected (Virtual)',
                      selected.length,
                      virtualCount,
                    );
                  } else if (physicalCount && !virtualCount) {
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
            </>
          );
        }}
      </ConfirmStatusChange>
    </>
  );
};

export default withToasts(DatasetList);
