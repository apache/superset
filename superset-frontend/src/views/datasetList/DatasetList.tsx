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
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import rison from 'rison';
// @ts-ignore
import { Panel } from 'react-bootstrap';
import { SHORT_DATE, SHORT_TIME } from 'src/utils/common';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DeleteModal from 'src/components/DeleteModal';
import ListView from 'src/components/ListView/ListView';
import SubMenu from 'src/components/Menu/SubMenu';
import AvatarIcon from 'src/components/AvatarIcon';
import {
  FetchDataConfig,
  FilterOperatorMap,
  Filters,
} from 'src/components/ListView/types';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import TooltipWrapper from 'src/components/TooltipWrapper';
import Icon from 'src/components/Icon';

const PAGE_SIZE = 25;

type Owner = {
  first_name: string;
  id: string;
  last_name: string;
  username: string;
};

interface DatasetListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

interface Dataset {
  changed_by: string;
  changed_by_name: string;
  changed_by_url: string;
  changed_on: string;
  databse_name: string;
  explore_url: string;
  id: number;
  owners: Array<Owner>;
  schema: string;
  table_name: string;
}

const DatasetList: FunctionComponent<DatasetListProps> = ({
  addDangerToast,
  addSuccessToast,
}) => {
  const [databases, setDatabases] = useState<{ text: string; value: number }[]>(
    [],
  );
  const [datasetCount, setDatasetCount] = useState(0);
  const [datasetCurrentlyDeleting, setDatasetCurrentlyDeleting] = useState<
    (Dataset & { chart_count: number; dashboard_count: number }) | null
  >(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [currentFilters, setCurrentFilters] = useState<Filters>([]);
  const [
    lastFetchDataConfig,
    setLastFetchDataConfig,
  ] = useState<FetchDataConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOwners, setCurrentOwners] = useState<
    { text: string; value: number }[]
  >([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  const updateFilters = (filterOperators: FilterOperatorMap) => {
    const convertFilter = ({
      name: label,
      operator,
    }: {
      name: string;
      operator: string;
    }) => ({ label, value: operator });
    setCurrentFilters([
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
        selects: currentOwners.map(({ text: label, value }) => ({
          label,
          value,
        })),
      },
      {
        Header: 'SQL Lab View',
        id: 'is_sqllab_view',
        input: 'checkbox',
        operators: filterOperators.is_sqllab_view.map(convertFilter),
      },
    ]);
  };

  const fetchDataset = () => {
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
        setCurrentOwners(ownersJson.result);
        setDatabases(databasesJson.result);
        setPermissions(infoJson.permissions);
        updateFilters(infoJson.filters);
      },
      ([e1, e2]) => {
        addDangerToast(t('An error occurred while fetching datasets'));
        if (e1) {
          console.error(e1);
        }
        if (e2) {
          console.error(e2);
        }
      },
    );
  };

  useEffect(() => {
    fetchDataset();
  }, []);

  const hasPerm = (perm: string) => {
    if (!permissions.length) {
      return false;
    }

    return Boolean(permissions.find(p => p === perm));
  };

  const canEdit = () => hasPerm('can_edit');
  const canDelete = () => hasPerm('can_delete');
  const canCreate = () => hasPerm('can_add');

  const initialSort = [{ id: 'changed_on', desc: true }];

  const handleDatasetEdit = ({ id }: { id: number }) => {
    window.location.assign(`/tablemodelview/edit/${id}`);
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
      .catch(() => {
        addDangerToast(
          t('An error occurred while fetching dataset related data'),
        );
      });

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
      accessor: 'database_name',
      disableSortBy: true,
      size: 'lg',
    },
    {
      Header: t('Schema'),
      accessor: 'schema',
      disableSortBy: true,
      size: 'lg',
    },
    {
      Cell: ({
        row: {
          original: { changed_on: changedOn },
        },
      }: any) => {
        const momentTime = moment(changedOn);
        const time = momentTime.format(SHORT_DATE);
        const date = momentTime.format(SHORT_TIME);
        return (
          <TooltipWrapper
            label="last-modified"
            tooltip={time}
            placement="right"
          >
            <span>{date}</span>
          </TooltipWrapper>
        );
      },
      Header: t('Last Modified'),
      accessor: 'changed_on',
      size: 'xl',
    },
    {
      Cell: ({
        row: {
          original: { changed_by_name: changedByName },
        },
      }: any) => changedByName,
      Header: t('Modified By'),
      accessor: 'changed_by_fk',
      disableSortBy: true,
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
        const handleEdit = () => handleDatasetEdit(original);
        const handleDelete = () => openDatasetDeleteModal(original);
        if (!canEdit() && !canDelete()) {
          return null;
        }
        return (
          <span
            className={`actions ${state && state.hover ? '' : 'invisible'}`}
          >
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

            {canEdit() && (
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

  const menu = {
    name: t('Data'),
    createButton: {
      name: t('Dataset'),
      url: '/tablemodelview/add',
    },
    childs: [
      {
        name: 'Datasets',
        label: t('Datasets'),
        url: '/tablemodelview/list/?_flt_1_is_sqllab_view=y',
      },
      { name: 'Databases', label: t('Databases'), url: '/databaseview/list/' },
      {
        name: 'Saved Queries',
        label: t('Saved Queries'),
        url: '/sqllab/my_queries/',
      },
    ],
  };

  const closeDatasetDeleteModal = () => {
    setDatasetCurrentlyDeleting(null);
  };

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
        .then(({ json }) => {
          setLoading(false);
          setDatasets(json.result);
          setDatasetCount(json.count);
        })
        .catch(() => {
          addDangerToast(t('An error occurred while fetching datasets'));
          setLoading(false);
        });
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
      (err: any) => {
        console.error(err);
        addDangerToast(t('There was an issue deleting %s', tableName));
      },
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
      (err: any) => {
        console.error(err);
        addDangerToast(t('There was an issue deleting the selected datasets'));
      },
    );
  };

  return (
    <>
      <SubMenu {...menu} canCreate={canCreate()} />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected datasets?',
        )}
        onConfirm={handleBulkDatasetDelete}
      >
        {confirmDelete => {
          const bulkActions = [];
          if (canDelete()) {
            bulkActions.push({
              key: 'delete',
              name: (
                <>
                  <i className="fa fa-trash" /> {t('Delete')}
                </>
              ),
              onSelect: confirmDelete,
            });
          }
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
              <ListView
                className="dataset-list-view"
                columns={columns}
                data={datasets}
                count={datasetCount}
                pageSize={PAGE_SIZE}
                fetchData={fetchData}
                loading={loading}
                initialSort={initialSort}
                filters={currentFilters}
                bulkActions={bulkActions}
              />
            </>
          );
        }}
      </ConfirmStatusChange>
    </>
  );
};

export default withToasts(DatasetList);
