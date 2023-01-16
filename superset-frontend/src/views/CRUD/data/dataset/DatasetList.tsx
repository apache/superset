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
import { SupersetClient, t, styled } from '@superset-ui/core';
import React, {
  FunctionComponent,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import rison from 'rison';
import { useHistory, useLocation } from 'react-router-dom';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
} from 'src/views/CRUD/utils';
import { getItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';
import { ColumnObject } from 'src/views/CRUD/data/dataset/types';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import { DatasourceModal } from 'src/components/Datasource';
import DeleteModal from 'src/components/DeleteModal';
import handleResourceExport from 'src/utils/export';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import Loading from 'src/components/Loading';
import SubMenu, {
  SubMenuProps,
  ButtonProps,
} from 'src/views/components/SubMenu';
import Owner from 'src/types/Owner';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import FacePile from 'src/components/FacePile';
import CertifiedBadge from 'src/components/CertifiedBadge';
import InfoTooltip from 'src/components/InfoTooltip';
import ImportModelsModal from 'src/components/ImportModal/index';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import WarningIconWithTooltip from 'src/components/WarningIconWithTooltip';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { GenericLink } from 'src/components/GenericLink/GenericLink';
import AddDatasetModal from './AddDatasetModal';

import {
  PAGE_SIZE,
  SORT_BY,
  PASSWORDS_NEEDED_MESSAGE,
  CONFIRM_OVERWRITE_MESSAGE,
} from './constants';
import DuplicateDatasetModal from './DuplicateDatasetModal';

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const Actions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};

  .disabled {
    svg,
    i {
      &:hover {
        path {
          fill: ${({ theme }) => theme.colors.grayscale.light1};
        }
      }
    }
    color: ${({ theme }) => theme.colors.grayscale.light1};
    .ant-menu-item:hover {
      color: ${({ theme }) => theme.colors.grayscale.light1};
      cursor: default;
    }
    &::after {
      color: ${({ theme }) => theme.colors.grayscale.light1};
    }
  }
`;

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

interface VirtualDataset extends Dataset {
  extra: Record<string, any>;
  sql: string;
}

interface DatasetListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

const DatasetList: FunctionComponent<DatasetListProps> = ({
  addDangerToast,
  addSuccessToast,
  user,
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

  const [datasetAddModalOpen, setDatasetAddModalOpen] =
    useState<boolean>(false);

  const [datasetCurrentlyDeleting, setDatasetCurrentlyDeleting] = useState<
    (Dataset & { chart_count: number; dashboard_count: number }) | null
  >(null);

  const [datasetCurrentlyEditing, setDatasetCurrentlyEditing] =
    useState<Dataset | null>(null);

  const [datasetCurrentlyDuplicating, setDatasetCurrentlyDuplicating] =
    useState<VirtualDataset | null>(null);

  const [importingDataset, showImportModal] = useState<boolean>(false);
  const [passwordFields, setPasswordFields] = useState<string[]>([]);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);

  const openDatasetImportModal = () => {
    showImportModal(true);
  };

  const closeDatasetImportModal = () => {
    showImportModal(false);
  };

  const handleDatasetImport = () => {
    showImportModal(false);
    refreshData();
    addSuccessToast(t('Dataset imported'));
  };

  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canCreate = hasPerm('can_write');
  const canDuplicate = hasPerm('can_duplicate');
  const canExport =
    hasPerm('can_export') && isFeatureEnabled(FeatureFlag.VERSIONED_EXPORT);

  const initialSort = SORT_BY;
  useEffect(() => {
    const db = getItem(LocalStorageKeys.db, null);
    if (!loading && db) {
      setDatasetAddModalOpen(true);
    }
  }, [loading]);

  const openDatasetEditModal = useCallback(
    ({ id }: Dataset) => {
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${id}`,
      })
        .then(({ json = {} }) => {
          const addCertificationFields = json.result.columns.map(
            (column: ColumnObject) => {
              const {
                certification: { details = '', certified_by = '' } = {},
              } = JSON.parse(column.extra || '{}') || {};
              return {
                ...column,
                certification_details: details || '',
                certified_by: certified_by || '',
                is_certified: details || certified_by,
              };
            },
          );
          // eslint-disable-next-line no-param-reassign
          json.result.columns = [...addCertificationFields];
          setDatasetCurrentlyEditing(json.result);
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

  const openDatasetDuplicateModal = (dataset: VirtualDataset) => {
    setDatasetCurrentlyDuplicating(dataset);
  };

  const handleBulkDatasetExport = (datasetsToExport: Dataset[]) => {
    const ids = datasetsToExport.map(({ id }) => id);
    handleResourceExport('dataset', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { kind },
          },
        }: any) => {
          if (kind === 'physical') {
            return (
              <Tooltip
                id="physical-dataset-tooltip"
                title={t('Physical dataset')}
              >
                <Icons.DatasetPhysical />
              </Tooltip>
            );
          }

          return (
            <Tooltip id="virtual-dataset-tooltip" title={t('Virtual dataset')}>
              <Icons.DatasetVirtual />
            </Tooltip>
          );
        },
        accessor: 'kind_icon',
        disableSortBy: true,
        size: 'xs',
        id: 'id',
      },
      {
        Cell: ({
          row: {
            original: {
              extra,
              table_name: datasetTitle,
              description,
              explore_url: exploreURL,
            },
          },
        }: any) => {
          const titleLink = (
            // exploreUrl can be a link to Explore or an external link
            // in the first case use SPA routing, else use HTML anchor
            <GenericLink to={exploreURL}>{datasetTitle}</GenericLink>
          );
          try {
            const parsedExtra = JSON.parse(extra);
            return (
              <FlexRowContainer>
                {parsedExtra?.certification && (
                  <CertifiedBadge
                    certifiedBy={parsedExtra.certification.certified_by}
                    details={parsedExtra.certification.details}
                    size="l"
                  />
                )}
                {parsedExtra?.warning_markdown && (
                  <WarningIconWithTooltip
                    warningMarkdown={parsedExtra.warning_markdown}
                    size="l"
                  />
                )}
                {titleLink}
                {description && (
                  <InfoTooltip tooltip={description} viewBox="0 -1 24 24" />
                )}
              </FlexRowContainer>
            );
          } catch {
            return titleLink;
          }
        },
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
        Header: t('Database'),
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
        Header: t('Modified by'),
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
            original: { owners = [] },
          },
        }: any) => <FacePile users={owners} />,
        Header: t('Owners'),
        id: 'owners',
        disableSortBy: true,
        size: 'lg',
      },
      {
        accessor: 'sql',
        hidden: true,
        disableSortBy: true,
      },
      {
        Cell: ({ row: { original } }: any) => {
          // Verify owner or isAdmin
          const allowEdit =
            original.owners.map((o: Owner) => o.id).includes(user.userId) ||
            isUserAdmin(user);

          const handleEdit = () => openDatasetEditModal(original);
          const handleDelete = () => openDatasetDeleteModal(original);
          const handleExport = () => handleBulkDatasetExport([original]);
          const handleDuplicate = () => openDatasetDuplicateModal(original);
          if (!canEdit && !canDelete && !canExport && !canDuplicate) {
            return null;
          }
          return (
            <Actions className="actions">
              {canDelete && (
                <Tooltip
                  id="delete-action-tooltip"
                  title={t('Delete')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleDelete}
                  >
                    <Icons.Trash />
                  </span>
                </Tooltip>
              )}
              {canExport && (
                <Tooltip
                  id="export-action-tooltip"
                  title={t('Export')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleExport}
                  >
                    <Icons.Share />
                  </span>
                </Tooltip>
              )}
              {canEdit && (
                <Tooltip
                  id="edit-action-tooltip"
                  title={
                    allowEdit
                      ? t('Edit')
                      : t(
                          'You must be a dataset owner in order to edit. Please reach out to a dataset owner to request modifications or edit access.',
                        )
                  }
                  placement="bottomRight"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className={allowEdit ? 'action-button' : 'disabled'}
                    onClick={allowEdit ? handleEdit : undefined}
                  >
                    <Icons.EditAlt />
                  </span>
                </Tooltip>
              )}
              {canDuplicate && original.kind === 'virtual' && (
                <Tooltip
                  id="duplicate-action-tooltop"
                  title={t('Duplicate')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleDuplicate}
                  >
                    <Icons.Copy />
                  </span>
                </Tooltip>
              )}
            </Actions>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canDelete && !canDuplicate,
        disableSortBy: true,
      },
    ],
    [canEdit, canDelete, canExport, openDatasetEditModal, canDuplicate],
  );

  const filterTypes: Filters = useMemo(
    () => [
      {
        Header: t('Owner'),
        key: 'owner',
        id: 'owners',
        input: 'select',
        operator: FilterOperator.relationManyMany,
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
          user,
        ),
        paginate: true,
      },
      {
        Header: t('Database'),
        key: 'database',
        id: 'database',
        input: 'select',
        operator: FilterOperator.relationOneMany,
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
        key: 'schema',
        id: 'schema',
        input: 'select',
        operator: FilterOperator.equals,
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
        key: 'sql',
        id: 'sql',
        input: 'select',
        operator: FilterOperator.datasetIsNullOrEmpty,
        unfilteredLabel: 'All',
        selects: [
          { label: t('Virtual'), value: false },
          { label: t('Physical'), value: true },
        ],
      },
      {
        Header: t('Certified'),
        key: 'certified',
        id: 'id',
        urlDisplay: 'certified',
        input: 'select',
        operator: FilterOperator.datasetIsCertified,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      },
      {
        Header: t('Search'),
        key: 'search',
        id: 'table_name',
        input: 'search',
        operator: FilterOperator.contains,
      },
    ],
    [],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Datasets',
    name: t('Datasets'),
  };

  const buttonArr: Array<ButtonProps> = [];

  if (canDelete || canExport) {
    buttonArr.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  const CREATE_HASH = '#create';
  const location = useLocation();
  const history = useHistory();

  //  Sync Dataset Add modal with #create hash
  useEffect(() => {
    const modalOpen = location.hash === CREATE_HASH && canCreate;
    setDatasetAddModalOpen(modalOpen);
  }, [canCreate, location.hash]);

  //  Add #create hash
  const openDatasetAddModal = useCallback(() => {
    history.replace(`${location.pathname}${location.search}${CREATE_HASH}`);
  }, [history, location.pathname, location.search]);

  //  Remove #create hash
  const closeDatasetAddModal = useCallback(() => {
    history.replace(`${location.pathname}${location.search}`);
  }, [history, location.pathname, location.search]);

  if (canCreate) {
    buttonArr.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Dataset')}{' '}
        </>
      ),
      onClick: openDatasetAddModal,
      buttonStyle: 'primary',
    });

    if (isFeatureEnabled(FeatureFlag.VERSIONED_EXPORT)) {
      buttonArr.push({
        name: (
          <Tooltip
            id="import-tooltip"
            title={t('Import datasets')}
            placement="bottomRight"
          >
            <Icons.Import data-test="import-button" />
          </Tooltip>
        ),
        buttonStyle: 'link',
        onClick: openDatasetImportModal,
      });
    }
  }

  menuData.buttons = buttonArr;

  const closeDatasetDeleteModal = () => {
    setDatasetCurrentlyDeleting(null);
  };

  const closeDatasetEditModal = () => {
    setDatasetCurrentlyEditing(null);
  };

  const closeDatasetDuplicateModal = () => {
    setDatasetCurrentlyDuplicating(null);
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

  const handleDatasetDuplicate = (newDatasetName: string) => {
    if (datasetCurrentlyDuplicating === null) {
      addDangerToast(t('There was an issue duplicating the dataset.'));
    }

    SupersetClient.post({
      endpoint: `/api/v1/dataset/duplicate`,
      jsonPayload: {
        base_model_id: datasetCurrentlyDuplicating?.id,
        table_name: newDatasetName,
      },
    }).then(
      () => {
        setDatasetCurrentlyDuplicating(null);
        refreshData();
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue duplicating the selected datasets: %s', errMsg),
        ),
      ),
    );
  };

  return (
    <>
      <SubMenu {...menuData} />
      <AddDatasetModal
        show={datasetAddModalOpen}
        onHide={closeDatasetAddModal}
        onDatasetAdd={refreshData}
        history={history}
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
      <DuplicateDatasetModal
        dataset={datasetCurrentlyDuplicating}
        onHide={closeDatasetDuplicateModal}
        onDuplicate={handleDatasetDuplicate}
      />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected datasets?',
        )}
        onConfirm={handleBulkDatasetDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canDelete) {
            bulkActions.push({
              key: 'delete',
              name: t('Delete'),
              onSelect: confirmDelete,
              type: 'danger',
            });
          }
          if (canExport) {
            bulkActions.push({
              key: 'export',
              name: t('Export'),
              type: 'primary',
              onSelect: handleBulkDatasetExport,
            });
          }
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
                    else if (e.original.kind === 'virtual') {
                      acc.virtualCount += 1;
                    }
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

      <ImportModelsModal
        resourceName="dataset"
        resourceLabel={t('dataset')}
        passwordsNeededMessage={PASSWORDS_NEEDED_MESSAGE}
        confirmOverwriteMessage={CONFIRM_OVERWRITE_MESSAGE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onModelImport={handleDatasetImport}
        show={importingDataset}
        onHide={closeDatasetImportModal}
        passwordFields={passwordFields}
        setPasswordFields={setPasswordFields}
      />
      {preparingExport && <Loading />}
    </>
  );
};

export default withToasts(DatasetList);
