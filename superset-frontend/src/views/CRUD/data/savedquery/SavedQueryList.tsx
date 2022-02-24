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
import React, { useState, useMemo, useCallback } from 'react';
import rison from 'rison';
import moment from 'moment';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
} from 'src/views/CRUD/utils';
import Popover from 'src/components/Popover';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import handleResourceExport from 'src/utils/export';
import SubMenu, {
  SubMenuProps,
  ButtonProps,
} from 'src/views/components/SubMenu';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import Loading from 'src/components/Loading';
import DeleteModal from 'src/components/DeleteModal';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import { Tooltip } from 'src/components/Tooltip';
import { commonMenuData } from 'src/views/CRUD/data/common';
import { SavedQueryObject } from 'src/views/CRUD/types';
import copyTextToClipboard from 'src/utils/copy';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import ImportModelsModal from 'src/components/ImportModal/index';
import Icons from 'src/components/Icons';
import SavedQueryPreviewModal from './SavedQueryPreviewModal';

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
  };
}

const StyledTableLabel = styled.div`
  .count {
    margin-left: 5px;
    color: ${({ theme }) => theme.colors.primary.base};
    text-decoration: underline;
    cursor: pointer;
  }
`;

const StyledPopoverItem = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
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
  const [queryCurrentlyDeleting, setQueryCurrentlyDeleting] =
    useState<SavedQueryObject | null>(null);
  const [savedQueryCurrentlyPreviewing, setSavedQueryCurrentlyPreviewing] =
    useState<SavedQueryObject | null>(null);
  const [importingSavedQuery, showImportModal] = useState<boolean>(false);
  const [passwordFields, setPasswordFields] = useState<string[]>([]);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);

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
  const canExport =
    hasPerm('can_export') && isFeatureEnabled(FeatureFlag.VERSIONED_EXPORT);

  const openNewQuery = () => {
    window.open(`${window.location.origin}/superset/sqllab?new=true`);
  };

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

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  subMenuButtons.push({
    name: (
      <>
        <i className="fa fa-plus" /> {t('Query')}
      </>
    ),
    onClick: openNewQuery,
    buttonStyle: 'primary',
  });

  if (canCreate && isFeatureEnabled(FeatureFlag.VERSIONED_EXPORT)) {
    subMenuButtons.push({
      name: (
        <Tooltip
          id="import-tooltip"
          title={t('Import queries')}
          placement="bottomRight"
          data-test="import-tooltip-test"
        >
          <Icons.Import data-test="import-icon" />
        </Tooltip>
      ),
      buttonStyle: 'link',
      onClick: openSavedQueryImportModal,
      'data-test': 'import-button',
    });
  }

  menuData.buttons = subMenuButtons;

  // Action methods
  const openInSqlLab = (id: number) => {
    window.open(`${window.location.origin}/superset/sqllab?savedQueryId=${id}`);
  };

  const copyQueryLink = useCallback(
    (id: number) => {
      copyTextToClipboard(
        `${window.location.origin}/superset/sqllab?savedQueryId=${id}`,
      )
        .then(() => {
          addSuccessToast(t('Link Copied!'));
        })
        .catch(() => {
          addDangerToast(t('Sorry, your browser does not support copying.'));
        });
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
      },
      {
        accessor: 'database.database_name',
        Header: t('Database'),
        size: 'xl',
      },
      {
        accessor: 'database',
        hidden: true,
        disableSortBy: true,
      },
      {
        accessor: 'schema',
        Header: t('Schema'),
        size: 'xl',
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
        size: 'xl',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { created_on: createdOn },
          },
        }: any) => {
          const date = new Date(createdOn);
          const utc = new Date(
            Date.UTC(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
              date.getHours(),
              date.getMinutes(),
              date.getSeconds(),
              date.getMilliseconds(),
            ),
          );

          return moment(utc).fromNow();
        },
        Header: t('Created on'),
        accessor: 'created_on',
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { changed_on_delta_humanized: changedOn },
          },
        }: any) => changedOn,
        Header: t('Modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handlePreview = () => {
            handleSavedQueryPreview(original.id);
          };
          const handleEdit = () => openInSqlLab(original.id);
          const handleCopy = () => copyQueryLink(original.id);
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
              icon: 'Edit',
              onClick: handleEdit,
            },
            {
              label: 'copy-action',
              tooltip: t('Copy query URL'),
              placement: 'bottom',
              icon: 'Copy',
              onClick: handleCopy,
            },
            canExport && {
              label: 'export-action',
              tooltip: t('Export query'),
              placement: 'bottom',
              icon: 'Share',
              onClick: handleExport,
            },
            canDelete && {
              label: 'delete-action',
              tooltip: t('Delete query'),
              placement: 'bottom',
              icon: 'Trash',
              onClick: handleDelete,
            },
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [canDelete, canEdit, canExport, copyQueryLink, handleSavedQueryPreview],
  );

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Database'),
        id: 'database',
        input: 'select',
        operator: FilterOperator.relationOneMany,
        unfilteredLabel: 'All',
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
        input: 'select',
        operator: FilterOperator.equals,
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
      {
        Header: t('Search'),
        id: 'label',
        input: 'search',
        operator: FilterOperator.allText,
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
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              highlightRowId={savedQueryCurrentlyPreviewing?.id}
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
      />
      {preparingExport && <Loading />}
    </>
  );
}

export default withToasts(SavedQueryList);
