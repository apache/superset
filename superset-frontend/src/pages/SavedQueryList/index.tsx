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
  FeatureFlag,
  isFeatureEnabled,
  styled,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { useCallback, useMemo, useState, MouseEvent } from 'react';
import { Link, useHistory } from 'react-router-dom';
import rison from 'rison';
import {
  createErrorHandler,
  createFetchDistinct,
  createFetchRelated,
} from 'src/views/CRUD/utils';
import { useSelector } from 'react-redux';
import {
  ConfirmStatusChange,
  DeleteModal,
  Loading,
  Popover,
  Tooltip,
} from '@superset-ui/core/components';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  ImportModal as ImportModelsModal,
  TagType,
  ModifiedInfo,
  TagsList,
  ListView,
  ListViewActionsBar,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewActionProps,
  type ListViewFilters,
} from 'src/components';
import handleResourceExport from 'src/utils/export';
import SubMenu, { ButtonProps, SubMenuProps } from 'src/features/home/SubMenu';
import { commonMenuData } from 'src/features/home/commonMenuData';
import { QueryObjectColumns, SavedQueryObject } from 'src/views/CRUD/types';
import { TagTypeEnum } from 'src/components/Tag/TagType';
import { loadTags } from 'src/components/Tag/utils';
import { Icons } from '@superset-ui/core/components/Icons';
import copyTextToClipboard from 'src/utils/copy';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import SavedQueryPreviewModal from 'src/features/queries/SavedQueryPreviewModal';
import { findPermission } from 'src/utils/findPermission';

const PAGE_SIZE = 25;
const PASSWORDS_NEEDED_MESSAGE = t(
  'The passwords for the databases below are needed in order to ' +
    'import them together with the saved queries. Please note that the ' +
    '"Secure Extra" and "Certificate" sections of ' +
    'the database configuration are not present in export files, and ' +
    'should be added manually after the import if they are needed.',
);
const CONFIRM_OVERWRITE_MESSAGE = t(
  'You are importing one or more saved queries that already exist. ' +
    'Overwriting might cause you to lose some of your work. Are you ' +
    'sure you want to overwrite?',
);

interface SavedQueryListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

const StyledTableLabel = styled.div`
  .count {
    margin-left: 5px;
    color: ${({ theme }) => theme.colorPrimary};
    text-decoration: underline;
    cursor: pointer;
  }
`;

const StyledPopoverItem = styled.div`
  color: ${({ theme }) => theme.colorText};
`;

function SavedQueryList({
  addDangerToast,
  addSuccessToast,
  user,
}: SavedQueryListProps) {
  const {
    state: {
      loading,
      resourceCount: queryCount,
      resourceCollection: queries,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<SavedQueryObject>(
    'saved_query',
    t('Saved queries'),
    addDangerToast,
  );
  const { roles } = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const canReadTag = findPermission('can_read', 'Tag', roles);
  const [queryCurrentlyDeleting, setQueryCurrentlyDeleting] =
    useState<SavedQueryObject | null>(null);
  const [savedQueryCurrentlyPreviewing, setSavedQueryCurrentlyPreviewing] =
    useState<SavedQueryObject | null>(null);
  const [importingSavedQuery, showImportModal] = useState<boolean>(false);
  const [passwordFields, setPasswordFields] = useState<string[]>([]);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [sshTunnelPasswordFields, setSSHTunnelPasswordFields] = useState<
    string[]
  >([]);
  const [sshTunnelPrivateKeyFields, setSSHTunnelPrivateKeyFields] = useState<
    string[]
  >([]);
  const [
    sshTunnelPrivateKeyPasswordFields,
    setSSHTunnelPrivateKeyPasswordFields,
  ] = useState<string[]>([]);
  const history = useHistory();

  const openSavedQueryImportModal = () => {
    showImportModal(true);
  };

  const closeSavedQueryImportModal = () => {
    showImportModal(false);
  };

  const handleSavedQueryImport = () => {
    showImportModal(false);
    refreshData();
    addSuccessToast(t('Query imported'));
  };

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');

  const handleSavedQueryPreview = useCallback(
    (id: number) => {
      SupersetClient.get({
        endpoint: `/api/v1/saved_query/${id}`,
      }).then(
        ({ json = {} }) => {
          setSavedQueryCurrentlyPreviewing({ ...json.result });
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue previewing the selected query %s', errMsg),
          ),
        ),
      );
    },
    [addDangerToast],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Saved queries',
    ...commonMenuData,
  };

  const subMenuButtons: Array<ButtonProps> = [];

  if (canCreate) {
    subMenuButtons.push({
      name: (
        <Tooltip
          id="import-tooltip"
          title={t('Import queries')}
          placement="bottomRight"
          data-test="import-tooltip-test"
        >
          <Icons.DownloadOutlined data-test="import-icon" iconSize="l" />
        </Tooltip>
      ),
      buttonStyle: 'link',
      onClick: openSavedQueryImportModal,
      'data-test': 'import-button',
    });
  }

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  subMenuButtons.push({
    icon: <Icons.PlusOutlined iconSize="m" />,
    name: t('Query'),
    buttonStyle: 'primary',
    onClick: () => {
      history.push('/sqllab?new=true');
    },
  });

  menuData.buttons = subMenuButtons;

  // Action methods
  const openInSqlLab = (id: number, openInNewWindow: boolean) => {
    copyTextToClipboard(() =>
      Promise.resolve(`${window.location.origin}/sqllab?savedQueryId=${id}`),
    )
      .then(() => {
        addSuccessToast(t('Link Copied!'));
      })
      .catch(() => {
        addDangerToast(t('Sorry, your browser does not support copying.'));
      });
    if (openInNewWindow) {
      window.open(`/sqllab?savedQueryId=${id}`);
    } else {
      history.push(`/sqllab?savedQueryId=${id}`);
    }
  };

  const copyQueryLink = useCallback(
    async (savedQuery: SavedQueryObject) => {
      try {
        const payload = {
          dbId: savedQuery.db_id,
          name: savedQuery.label,
          schema: savedQuery.schema,
          catalog: savedQuery.catalog,
          sql: savedQuery.sql,
          autorun: false,
          templateParams: null,
        };

        const response = await SupersetClient.post({
          endpoint: '/api/v1/sqllab/permalink',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const { url: permalink } = response.json;

        await navigator.clipboard.writeText(permalink);
        addSuccessToast(t('Link Copied!'));
      } catch (error) {
        addDangerToast(t('There was an error generating the permalink.'));
      }
    },
    [addDangerToast, addSuccessToast],
  );

  const handleQueryDelete = ({ id, label }: SavedQueryObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/saved_query/${id}`,
    }).then(
      () => {
        refreshData();
        setQueryCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', label));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', label, errMsg)),
      ),
    );
  };

  const handleBulkSavedQueryExport = (
    savedQueriesToExport: SavedQueryObject[],
  ) => {
    const ids = savedQueriesToExport.map(({ id }) => id);
    handleResourceExport('saved_query', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  const handleBulkQueryDelete = (queriesToDelete: SavedQueryObject[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/saved_query/?q=${rison.encode(
        queriesToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected queries: %s', errMsg),
        ),
      ),
    );
  };

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'label',
        Header: t('Name'),
        size: 'xxl',
        Cell: ({
          row: {
            original: { id, label },
          },
        }: any) => <Link to={`/sqllab?savedQueryId=${id}`}>{label}</Link>,
        id: 'label',
      },
      {
        accessor: 'description',
        Header: t('Description'),
        size: 'xl',
        id: 'description',
      },
      {
        accessor: 'database.database_name',
        Header: t('Database'),
        size: 'lg',
        id: 'database.database_name',
      },
      {
        accessor: 'database',
        hidden: true,
        disableSortBy: true,
        id: 'database',
      },
      {
        accessor: 'schema',
        Header: t('Schema'),
        size: 'lg',
        id: 'schema',
      },
      {
        Cell: ({
          row: {
            original: { sql_tables: tables = [] },
          },
        }: any) => {
          const names = tables.map((table: any) => table.table);
          const main = names?.shift() || '';

          if (names.length) {
            return (
              <StyledTableLabel>
                <span>{main}</span>
                <Popover
                  placement="right"
                  title={t('TABLES')}
                  trigger="click"
                  content={
                    <>
                      {names.map((name: string) => (
                        <StyledPopoverItem key={name}>{name}</StyledPopoverItem>
                      ))}
                    </>
                  }
                >
                  <span className="count">(+{names.length})</span>
                </Popover>
              </StyledTableLabel>
            );
          }

          return main;
        },
        accessor: 'sql_tables',
        Header: t('Tables'),
        size: 'lg',
        disableSortBy: true,
        id: 'sql_tables',
      },
      {
        Cell: ({
          row: {
            original: { tags = [] },
          },
        }: any) => (
          // Only show custom type tags
          <TagsList
            tags={tags.filter(
              (tag: TagType) => tag.type === TagTypeEnum.Custom,
            )}
          />
        ),
        Header: t('Tags'),
        accessor: 'tags',
        disableSortBy: true,
        hidden: !isFeatureEnabled(FeatureFlag.TaggingSystem),
        id: 'tags',
      },
      {
        Cell: ({
          row: {
            original: {
              changed_by: changedBy,
              changed_on_delta_humanized: changedOn,
            },
          },
        }: any) => <ModifiedInfo user={changedBy} date={changedOn} />,
        Header: t('Last modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
        id: 'changed_on_delta_humanized',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handlePreview = () => {
            handleSavedQueryPreview(original.id);
          };
          const handleEdit = ({ metaKey }: MouseEvent) =>
            openInSqlLab(original.id, Boolean(metaKey));
          const handleCopy = () => copyQueryLink(original);
          const handleExport = () => handleBulkSavedQueryExport([original]);
          const handleDelete = () => setQueryCurrentlyDeleting(original);

          const actions = [
            {
              label: 'preview-action',
              tooltip: t('Query preview'),
              placement: 'bottom',
              icon: 'Binoculars',
              onClick: handlePreview,
            },
            canEdit && {
              label: 'edit-action',
              tooltip: t('Edit query'),
              placement: 'bottom',
              icon: 'EditOutlined',
              onClick: handleEdit,
            },
            {
              label: 'copy-action',
              tooltip: t('Copy query URL'),
              placement: 'bottom',
              icon: 'CopyOutlined',
              onClick: handleCopy,
            },
            canExport && {
              label: 'export-action',
              tooltip: t('Export query'),
              placement: 'bottom',
              icon: 'UploadOutlined',
              onClick: handleExport,
            },
            canDelete && {
              label: 'delete-action',
              tooltip: t('Delete query'),
              placement: 'bottom',
              icon: 'DeleteOutlined',
              onClick: handleDelete,
            },
          ].filter(item => !!item);

          return (
            <ListViewActionsBar actions={actions as ListViewActionProps[]} />
          );
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
        id: QueryObjectColumns.ChangedBy,
      },
    ],
    [canDelete, canEdit, canExport, copyQueryLink, handleSavedQueryPreview],
  );

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Search'),
        id: 'label',
        key: 'search',
        input: 'search',
        operator: FilterOperator.AllText,
        toolTipDescription:
          'Searches all text fields: Name, Description, Database & Schema',
      },
      {
        Header: t('Database'),
        key: 'database',
        id: 'database',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'saved_query',
          'database',
          createErrorHandler(errMsg =>
            addDangerToast(
              t(
                'An error occurred while fetching dataset datasource values: %s',
                errMsg,
              ),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Schema'),
        id: 'schema',
        key: 'schema',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: 'All',
        fetchSelects: createFetchDistinct(
          'saved_query',
          'schema',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching schema values: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      ...((isFeatureEnabled(FeatureFlag.TaggingSystem) && canReadTag
        ? [
            {
              Header: t('Tag'),
              id: 'tags',
              key: 'tags',
              input: 'select',
              operator: FilterOperator.SavedQueryTagById,
              fetchSelects: loadTags,
            },
          ]
        : []) as ListViewFilters),
      {
        Header: t('Modified by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'saved_query',
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
    [addDangerToast],
  );

  return (
    <>
      <SubMenu {...menuData} />
      {queryCurrentlyDeleting && (
        <DeleteModal
          description={t(
            'This action will permanently delete the saved query.',
          )}
          onConfirm={() => {
            if (queryCurrentlyDeleting) {
              handleQueryDelete(queryCurrentlyDeleting);
            }
          }}
          onHide={() => setQueryCurrentlyDeleting(null)}
          open
          title={t('Delete Query?')}
        />
      )}
      {savedQueryCurrentlyPreviewing && (
        <SavedQueryPreviewModal
          fetchData={handleSavedQueryPreview}
          onHide={() => setSavedQueryCurrentlyPreviewing(null)}
          savedQuery={savedQueryCurrentlyPreviewing}
          queries={queries}
          openInSqlLab={openInSqlLab}
          show
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected queries?')}
        onConfirm={handleBulkQueryDelete}
      >
        {confirmDelete => {
          const enableBulkTag = isFeatureEnabled(FeatureFlag.TaggingSystem);
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
              onSelect: handleBulkSavedQueryExport,
            });
          }
          return (
            <ListView<SavedQueryObject>
              className="saved_query-list-view"
              columns={columns}
              count={queryCount}
              data={queries}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              addSuccessToast={addSuccessToast}
              addDangerToast={addDangerToast}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              highlightRowId={savedQueryCurrentlyPreviewing?.id}
              enableBulkTag={enableBulkTag}
              bulkTagResourceName="query"
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>

      <ImportModelsModal
        resourceName="saved_query"
        resourceLabel={t('queries')}
        passwordsNeededMessage={PASSWORDS_NEEDED_MESSAGE}
        confirmOverwriteMessage={CONFIRM_OVERWRITE_MESSAGE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onModelImport={handleSavedQueryImport}
        show={importingSavedQuery}
        onHide={closeSavedQueryImportModal}
        passwordFields={passwordFields}
        setPasswordFields={setPasswordFields}
        sshTunnelPasswordFields={sshTunnelPasswordFields}
        setSSHTunnelPasswordFields={setSSHTunnelPasswordFields}
        sshTunnelPrivateKeyFields={sshTunnelPrivateKeyFields}
        setSSHTunnelPrivateKeyFields={setSSHTunnelPrivateKeyFields}
        sshTunnelPrivateKeyPasswordFields={sshTunnelPrivateKeyPasswordFields}
        setSSHTunnelPrivateKeyPasswordFields={
          setSSHTunnelPrivateKeyPasswordFields
        }
      />
      {preparingExport && <Loading />}
    </>
  );
}

export default withToasts(SavedQueryList);
