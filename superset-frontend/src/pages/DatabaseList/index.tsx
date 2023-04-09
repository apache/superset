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
import { FeatureFlag, styled, SupersetClient, t } from '@superset-ui/core';
import React, { useState, useMemo, useEffect } from 'react';
import rison from 'rison';
import { useSelector } from 'react-redux';
import { useQueryParams, BooleanParam } from 'use-query-params';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';

import Loading from 'src/components/Loading';
import { isFeatureEnabled } from 'src/featureFlags';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler, uploadUserPerms } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import DeleteModal from 'src/components/DeleteModal';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import ListView, { FilterOperator, Filters } from 'src/components/ListView';
import handleResourceExport from 'src/utils/export';
import { ExtensionConfigs } from 'src/features/home/types';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import type { MenuObjectProps } from 'src/types/bootstrapTypes';
import DatabaseModal from 'src/features/databases/DatabaseModal';
import { DatabaseObject } from 'src/features/databases/types';

const PAGE_SIZE = 25;

interface DatabaseDeleteObject extends DatabaseObject {
  chart_count: number;
  dashboard_count: number;
  sqllab_tab_count: number;
}
interface DatabaseListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const IconCheck = styled(Icons.Check)`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

const IconCancelX = styled(Icons.CancelX)`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

const Actions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};

  .action-button {
    display: inline-block;
    height: 100%;
  }
`;

function BooleanDisplay({ value }: { value: Boolean }) {
  return value ? <IconCheck /> : <IconCancelX />;
}

function DatabaseList({ addDangerToast, addSuccessToast }: DatabaseListProps) {
  const {
    state: {
      loading,
      resourceCount: databaseCount,
      resourceCollection: databases,
    },
    hasPerm,
    fetchData,
    refreshData,
  } = useListViewResource<DatabaseObject>(
    'database',
    t('database'),
    addDangerToast,
  );
  const user = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const showDatabaseModal = getUrlParam(URL_PARAMS.showDatabaseModal);

  const [query, setQuery] = useQueryParams({
    databaseAdded: BooleanParam,
  });

  const [databaseModalOpen, setDatabaseModalOpen] = useState<boolean>(
    showDatabaseModal || false,
  );
  const [databaseCurrentlyDeleting, setDatabaseCurrentlyDeleting] =
    useState<DatabaseDeleteObject | null>(null);
  const [currentDatabase, setCurrentDatabase] = useState<DatabaseObject | null>(
    null,
  );
  const [allowUploads, setAllowUploads] = useState<boolean>(false);
  const isAdmin = isUserAdmin(user);
  const showUploads = allowUploads || isAdmin;

  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const { roles } = user;
  const {
    CSV_EXTENSIONS,
    COLUMNAR_EXTENSIONS,
    EXCEL_EXTENSIONS,
    ALLOWED_EXTENSIONS,
  } = useSelector<any, ExtensionConfigs>(state => state.common.conf);

  useEffect(() => {
    if (query?.databaseAdded) {
      setQuery({ databaseAdded: undefined });
      refreshData();
    }
  }, [query, setQuery, refreshData]);

  const openDatabaseDeleteModal = (database: DatabaseObject) =>
    SupersetClient.get({
      endpoint: `/api/v1/database/${database.id}/related_objects/`,
    })
      .then(({ json = {} }) => {
        setDatabaseCurrentlyDeleting({
          ...database,
          chart_count: json.charts.count,
          dashboard_count: json.dashboards.count,
          sqllab_tab_count: json.sqllab_tab_states.count,
        });
      })
      .catch(
        createErrorHandler(errMsg =>
          t(
            'An error occurred while fetching database related data: %s',
            errMsg,
          ),
        ),
      );

  function handleDatabaseDelete({ id, database_name: dbName }: DatabaseObject) {
    SupersetClient.delete({
      endpoint: `/api/v1/database/${id}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t('Deleted: %s', dbName));

        // Delete user-selected db from local storage
        setItem(LocalStorageKeys.db, null);

        // Close delete modal
        setDatabaseCurrentlyDeleting(null);
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', dbName, errMsg)),
      ),
    );
  }

  function handleDatabaseEditModal({
    database = null,
    modalOpen = false,
  }: { database?: DatabaseObject | null; modalOpen?: boolean } = {}) {
    // Set database and modal
    setCurrentDatabase(database);
    setDatabaseModalOpen(modalOpen);
  }

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport =
    hasPerm('can_export') && isFeatureEnabled(FeatureFlag.VERSIONED_EXPORT);

  const { canUploadCSV, canUploadColumnar, canUploadExcel } = uploadUserPerms(
    roles,
    CSV_EXTENSIONS,
    COLUMNAR_EXTENSIONS,
    EXCEL_EXTENSIONS,
    ALLOWED_EXTENSIONS,
  );

  const isDisabled = isAdmin && !allowUploads;

  const uploadDropdownMenu = [
    {
      label: t('Upload file to database'),
      childs: [
        {
          label: t('Upload CSV'),
          name: 'Upload CSV file',
          url: '/csvtodatabaseview/form',
          perm: canUploadCSV && showUploads,
          disable: isDisabled,
        },
        {
          label: t('Upload columnar file'),
          name: 'Upload columnar file',
          url: '/columnartodatabaseview/form',
          perm: canUploadColumnar && showUploads,
          disable: isDisabled,
        },
        {
          label: t('Upload Excel file'),
          name: 'Upload Excel file',
          url: '/exceltodatabaseview/form',
          perm: canUploadExcel && showUploads,
          disable: isDisabled,
        },
      ],
    },
  ];

  const hasFileUploadEnabled = () => {
    const payload = {
      filters: [
        { col: 'allow_file_upload', opr: 'upload_is_enabled', value: true },
      ],
    };
    SupersetClient.get({
      endpoint: `/api/v1/database/?q=${rison.encode(payload)}`,
    }).then(({ json }: Record<string, any>) => {
      // There might be some existings Gsheets and Clickhouse DBs
      // with allow_file_upload set as True which is not possible from now on
      const allowedDatabasesWithFileUpload =
        json?.result?.filter(
          (database: any) => database?.engine_information?.supports_file_upload,
        ) || [];
      setAllowUploads(allowedDatabasesWithFileUpload?.length >= 1);
    });
  };

  useEffect(() => hasFileUploadEnabled(), [databaseModalOpen]);

  const filteredDropDown = uploadDropdownMenu.reduce((prev, cur) => {
    // eslint-disable-next-line no-param-reassign
    cur.childs = cur.childs.filter(item => item.perm);
    if (!cur.childs.length) return prev;
    prev.push(cur);
    return prev;
  }, [] as MenuObjectProps[]);

  const menuData: SubMenuProps = {
    activeChild: 'Databases',
    dropDownLinks: filteredDropDown,
    name: t('Databases'),
  };

  if (canCreate) {
    menuData.buttons = [
      {
        'data-test': 'btn-create-database',
        name: (
          <>
            <i className="fa fa-plus" /> {t('Database')}{' '}
          </>
        ),
        buttonStyle: 'primary',
        onClick: () => {
          // Ensure modal will be opened in add mode
          handleDatabaseEditModal({ modalOpen: true });
        },
      },
    ];
  }

  function handleDatabaseExport(database: DatabaseObject) {
    if (database.id === undefined) {
      return;
    }

    handleResourceExport('database', [database.id], () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  }

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  const columns = useMemo(
    () => [
      {
        accessor: 'database_name',
        Header: t('Database'),
      },
      {
        accessor: 'backend',
        Header: t('Backend'),
        size: 'lg',
        disableSortBy: true, // TODO: api support for sorting by 'backend'
      },
      {
        accessor: 'allow_run_async',
        Header: (
          <Tooltip
            id="allow-run-async-header-tooltip"
            title={t('Asynchronous query execution')}
            placement="top"
          >
            <span>{t('AQE')}</span>
          </Tooltip>
        ),
        Cell: ({
          row: {
            original: { allow_run_async: allowRunAsync },
          },
        }: {
          row: { original: { allow_run_async: boolean } };
        }) => <BooleanDisplay value={allowRunAsync} />,
        size: 'sm',
      },
      {
        accessor: 'allow_dml',
        Header: (
          <Tooltip
            id="allow-dml-header-tooltip"
            title={t('Allow data manipulation language')}
            placement="top"
          >
            <span>{t('DML')}</span>
          </Tooltip>
        ),
        Cell: ({
          row: {
            original: { allow_dml: allowDML },
          },
        }: any) => <BooleanDisplay value={allowDML} />,
        size: 'sm',
      },
      {
        accessor: 'allow_file_upload',
        Header: t('CSV upload'),
        Cell: ({
          row: {
            original: { allow_file_upload: allowFileUpload },
          },
        }: any) => <BooleanDisplay value={allowFileUpload} />,
        size: 'md',
      },
      {
        accessor: 'expose_in_sqllab',
        Header: t('Expose in SQL Lab'),
        Cell: ({
          row: {
            original: { expose_in_sqllab: exposeInSqllab },
          },
        }: any) => <BooleanDisplay value={exposeInSqllab} />,
        size: 'md',
      },
      {
        accessor: 'created_by',
        disableSortBy: true,
        Header: t('Created by'),
        Cell: ({
          row: {
            original: { created_by: createdBy },
          },
        }: any) =>
          createdBy ? `${createdBy.first_name} ${createdBy.last_name}` : '',
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { changed_on_delta_humanized: changedOn },
          },
        }: any) => changedOn,
        Header: t('Last modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () =>
            handleDatabaseEditModal({ database: original, modalOpen: true });
          const handleDelete = () => openDatabaseDeleteModal(original);
          const handleExport = () => handleDatabaseExport(original);
          if (!canEdit && !canDelete && !canExport) {
            return null;
          }
          return (
            <Actions className="actions">
              {canDelete && (
                <span
                  role="button"
                  tabIndex={0}
                  className="action-button"
                  data-test="database-delete"
                  onClick={handleDelete}
                >
                  <Tooltip
                    id="delete-action-tooltip"
                    title={t('Delete database')}
                    placement="bottom"
                  >
                    <Icons.Trash />
                  </Tooltip>
                </span>
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
                  title={t('Edit')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    data-test="database-edit"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleEdit}
                  >
                    <Icons.EditAlt data-test="edit-alt" />
                  </span>
                </Tooltip>
              )}
            </Actions>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canDelete,
        disableSortBy: true,
      },
    ],
    [canDelete, canEdit, canExport],
  );

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Expose in SQL Lab'),
        key: 'expose_in_sql_lab',
        id: 'expose_in_sqllab',
        input: 'select',
        operator: FilterOperator.equals,
        unfilteredLabel: t('All'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      },
      {
        Header: (
          <Tooltip
            id="allow-run-async-filter-header-tooltip"
            title={t('Asynchronous query execution')}
            placement="top"
          >
            <span>{t('AQE')}</span>
          </Tooltip>
        ),
        key: 'allow_run_async',
        id: 'allow_run_async',
        input: 'select',
        operator: FilterOperator.equals,
        unfilteredLabel: t('All'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      },
      {
        Header: t('Search'),
        key: 'search',
        id: 'database_name',
        input: 'search',
        operator: FilterOperator.contains,
      },
    ],
    [],
  );

  return (
    <>
      <SubMenu {...menuData} />
      <DatabaseModal
        databaseId={currentDatabase?.id}
        show={databaseModalOpen}
        onHide={handleDatabaseEditModal}
        onDatabaseAdd={() => {
          refreshData();
        }}
      />
      {databaseCurrentlyDeleting && (
        <DeleteModal
          description={t(
            'The database %s is linked to %s charts that appear on %s dashboards and users have %s SQL Lab tabs using this database open. Are you sure you want to continue? Deleting the database will break those objects.',
            databaseCurrentlyDeleting.database_name,
            databaseCurrentlyDeleting.chart_count,
            databaseCurrentlyDeleting.dashboard_count,
            databaseCurrentlyDeleting.sqllab_tab_count,
          )}
          onConfirm={() => {
            if (databaseCurrentlyDeleting) {
              handleDatabaseDelete(databaseCurrentlyDeleting);
            }
          }}
          onHide={() => setDatabaseCurrentlyDeleting(null)}
          open
          title={t('Delete Database?')}
        />
      )}

      <ListView<DatabaseObject>
        className="database-list-view"
        columns={columns}
        count={databaseCount}
        data={databases}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
      />

      {preparingExport && <Loading />}
    </>
  );
}

export default withToasts(DatabaseList);
