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
import {
  getExtensionsRegistry,
  styled,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { useState, useMemo, useEffect } from 'react';
import rison from 'rison';
import { useSelector } from 'react-redux';
import { useQueryParams, BooleanParam } from 'use-query-params';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';
import Loading from 'src/components/Loading';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  createErrorHandler,
  createFetchRelated,
  uploadUserPerms,
} from 'src/views/CRUD/utils';
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
import UploadDataModal from 'src/features/databases/UploadDataModel';
import { DatabaseObject } from 'src/features/databases/types';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';

const extensionsRegistry = getExtensionsRegistry();
const DatabaseDeleteRelatedExtension = extensionsRegistry.get(
  'database.delete.related',
);
const dbConfigExtraExtension = extensionsRegistry.get(
  'databaseconnection.extraOption',
);

const PAGE_SIZE = 25;

interface DatabaseDeleteObject extends DatabaseObject {
  charts: any;
  dashboards: any;
  sqllab_tab_count: number;
}
interface DatabaseListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

const IconCheck = styled(Icons.Check)`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

const IconCancelX = styled(Icons.CancelX)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
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

function DatabaseList({
  addDangerToast,
  addSuccessToast,
  user,
}: DatabaseListProps) {
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
  const fullUser = useSelector<any, UserWithPermissionsAndRoles>(
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
  const [csvUploadDataModalOpen, setCsvUploadDataModalOpen] =
    useState<boolean>(false);
  const [excelUploadDataModalOpen, setExcelUploadDataModalOpen] =
    useState<boolean>(false);
  const [columnarUploadDataModalOpen, setColumnarUploadDataModalOpen] =
    useState<boolean>(false);

  const [allowUploads, setAllowUploads] = useState<boolean>(false);
  const isAdmin = isUserAdmin(fullUser);
  const showUploads = allowUploads || isAdmin;

  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const { roles } = fullUser;
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
          charts: json.charts,
          dashboards: json.dashboards,
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

  function handleDatabaseDelete(database: DatabaseObject) {
    const { id, database_name: dbName } = database;
    SupersetClient.delete({
      endpoint: `/api/v1/database/${id}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t('Deleted: %s', dbName));

        // Remove any extension-related data
        if (dbConfigExtraExtension?.onDelete) {
          dbConfigExtraExtension.onDelete(database);
        }

        // Delete user-selected db from local storage
        setItem(LocalStorageKeys.Database, null);

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
  const canExport = hasPerm('can_export');

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
          url: '#',
          onClick: () => {
            setCsvUploadDataModalOpen(true);
          },
          perm: canUploadCSV && showUploads,
          disable: isDisabled,
        },
        {
          label: t('Upload Excel'),
          name: 'Upload Excel file',
          url: '#',
          onClick: () => {
            setExcelUploadDataModalOpen(true);
          },
          perm: canUploadExcel && showUploads,
          disable: isDisabled,
        },
        {
          label: t('Upload Columnar'),
          name: 'Upload columnar file',
          url: '#',
          onClick: () => {
            setColumnarUploadDataModalOpen(true);
          },
          perm: canUploadColumnar && showUploads,
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
      // There might be some existing Gsheets and Clickhouse DBs
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
        Header: t('Name'),
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
        Header: t('File upload'),
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
        Cell: ({
          row: {
            original: {
              changed_by: changedBy,
              changed_on_delta_humanized: changedOn,
            },
          },
        }: any) => <ModifiedInfo date={changedOn} user={changedBy} />,
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
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
      },
    ],
    [canDelete, canEdit, canExport],
  );

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'database_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Expose in SQL Lab'),
        key: 'expose_in_sql_lab',
        id: 'expose_in_sqllab',
        input: 'select',
        operator: FilterOperator.Equals,
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
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      },
      {
        Header: t('Modified by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'database',
          'changed_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset datasource values: %s',
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
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
      <UploadDataModal
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onHide={() => {
          setCsvUploadDataModalOpen(false);
        }}
        show={csvUploadDataModalOpen}
        allowedExtensions={CSV_EXTENSIONS}
        type="csv"
      />
      <UploadDataModal
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onHide={() => {
          setExcelUploadDataModalOpen(false);
        }}
        show={excelUploadDataModalOpen}
        allowedExtensions={EXCEL_EXTENSIONS}
        type="excel"
      />
      <UploadDataModal
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onHide={() => {
          setColumnarUploadDataModalOpen(false);
        }}
        show={columnarUploadDataModalOpen}
        allowedExtensions={COLUMNAR_EXTENSIONS}
        type="columnar"
      />
      {databaseCurrentlyDeleting && (
        <DeleteModal
          description={
            <>
              <p>
                {t('The database')}{' '}
                <b>{databaseCurrentlyDeleting.database_name}</b>{' '}
                {t(
                  'is linked to %s charts that appear on %s dashboards and users have %s SQL Lab tabs using this database open. Are you sure you want to continue? Deleting the database will break those objects.',
                  databaseCurrentlyDeleting.charts.count,
                  databaseCurrentlyDeleting.dashboards.count,
                  databaseCurrentlyDeleting.sqllab_tab_count,
                )}
              </p>
              {databaseCurrentlyDeleting.dashboards.count >= 1 && (
                <>
                  <h4>{t('Affected Dashboards')}</h4>
                  <ul>
                    {databaseCurrentlyDeleting.dashboards.result
                      .slice(0, 10)
                      .map(
                        (
                          result: { id: number; title: string },
                          index: number,
                        ) => (
                          <li key={result.id}>
                            <a
                              href={`/superset/dashboard/${result.id}`}
                              target="_atRiskItem"
                            >
                              {result.title}
                            </a>
                          </li>
                        ),
                      )}
                    {databaseCurrentlyDeleting.dashboards.result.length >
                      10 && (
                      <li>
                        {t(
                          '... and %s others',
                          databaseCurrentlyDeleting.dashboards.result.length -
                            10,
                        )}
                      </li>
                    )}
                  </ul>
                </>
              )}
              {databaseCurrentlyDeleting.charts.count >= 1 && (
                <>
                  <h4>{t('Affected Charts')}</h4>
                  <ul>
                    {databaseCurrentlyDeleting.charts.result.slice(0, 10).map(
                      (
                        result: {
                          id: number;
                          slice_name: string;
                        },
                        index: number,
                      ) => (
                        <li key={result.id}>
                          <a
                            href={`/explore/?slice_id=${result.id}`}
                            target="_atRiskItem"
                          >
                            {result.slice_name}
                          </a>
                        </li>
                      ),
                    )}
                    {databaseCurrentlyDeleting.charts.result.length > 10 && (
                      <li>
                        {t(
                          '... and %s others',
                          databaseCurrentlyDeleting.charts.result.length - 10,
                        )}
                      </li>
                    )}
                  </ul>
                </>
              )}
              {DatabaseDeleteRelatedExtension && (
                <DatabaseDeleteRelatedExtension
                  database={databaseCurrentlyDeleting}
                />
              )}
            </>
          }
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
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        refreshData={() => {}}
        pageSize={PAGE_SIZE}
      />

      {preparingExport && <Loading />}
    </>
  );
}

export default withToasts(DatabaseList);
