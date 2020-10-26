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
import { Popover } from 'src/common/components';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu, {
  SubMenuProps,
  ButtonProps,
} from 'src/components/Menu/SubMenu';
import ListView, { ListViewProps, Filters } from 'src/components/ListView';
import DeleteModal from 'src/components/DeleteModal';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import { IconName } from 'src/components/Icon';
import { commonMenuData } from 'src/views/CRUD/data/common';
import SavedQueryPreviewModal from './SavedQueryPreviewModal';

const PAGE_SIZE = 25;

interface SavedQueryListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

type SavedQueryObject = {
  database: {
    database_name: string;
    id: number;
  };
  db_id: number;
  description?: string;
  id: number;
  label: string;
  schema: string;
  sql: string;
  sql_tables: Array<{ catalog?: string; schema: string; table: string }>;
};

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
    t('saved_queries'),
    addDangerToast,
  );
  const [
    queryCurrentlyDeleting,
    setQueryCurrentlyDeleting,
  ] = useState<SavedQueryObject | null>(null);
  const [
    savedQueryCurrentlyPreviewing,
    setSavedQueryCurrentlyPreviewing,
  ] = useState<SavedQueryObject | null>(null);

  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');

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
    activeChild: 'Saved Queries',
    ...commonMenuData,
  };

  const subMenuButtons: Array<ButtonProps> = [];

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk Select'),
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

  menuData.buttons = subMenuButtons;

  // Action methods
  const openInSqlLab = (id: number) => {
    window.open(`${window.location.origin}/superset/sqllab?savedQueryId=${id}`);
  };

  const copyQueryLink = useCallback(
    (id: number) => {
      const selection: Selection | null = document.getSelection();

      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        const span = document.createElement('span');
        span.textContent = `${window.location.origin}/superset/sqllab?savedQueryId=${id}`;
        span.style.position = 'fixed';
        span.style.top = '0';
        span.style.clip = 'rect(0, 0, 0, 0)';
        span.style.whiteSpace = 'pre';

        document.body.appendChild(span);
        range.selectNode(span);
        selection.addRange(range);

        try {
          if (!document.execCommand('copy')) {
            throw new Error(t('Not successful'));
          }
        } catch (err) {
          addDangerToast(t('Sorry, your browser does not support copying.'));
        }

        document.body.removeChild(span);
        if (selection.removeRange) {
          selection.removeRange(range);
        } else {
          selection.removeAllRanges();
        }

        addSuccessToast(t('Link Copied!'));
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
            original: { sql_tables: tables },
          },
        }: any) => {
          const names = tables.map((table: any) => table.table);
          const main = names.length > 0 ? names.shift() : '';

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
                        <StyledPopoverItem>{name}</StyledPopoverItem>
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
        Header: t('Created On'),
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
          const handleEdit = () => {
            openInSqlLab(original.id);
          };
          const handleCopy = () => {
            copyQueryLink(original.id);
          };
          const handleDelete = () => setQueryCurrentlyDeleting(original);

          const actions = [
            {
              label: 'preview-action',
              tooltip: t('Query preview'),
              placement: 'bottom',
              icon: 'binoculars' as IconName,
              onClick: handlePreview,
            },
            canEdit
              ? {
                  label: 'edit-action',
                  tooltip: t('Edit query'),
                  placement: 'bottom',
                  icon: 'edit' as IconName,
                  onClick: handleEdit,
                }
              : null,
            {
              label: 'copy-action',
              tooltip: t('Copy query URL'),
              placement: 'bottom',
              icon: 'copy' as IconName,
              onClick: handleCopy,
            },
            canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete query'),
                  placement: 'bottom',
                  icon: 'trash' as IconName,
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [canDelete, canEdit, copyQueryLink, handleSavedQueryPreview],
  );

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Database'),
        id: 'database',
        input: 'select',
        operator: 'rel_o_m',
        unfilteredLabel: 'All',
        fetchSelects: createFetchRelated(
          'saved_query',
          'database',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset datasource values: %s',
              errMsg,
            ),
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
          'saved_query',
          'schema',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching schema values: %s', errMsg),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Search'),
        id: 'label',
        input: 'search',
        operator: 'all_text',
      },
    ],
    [],
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
    </>
  );
}

export default withToasts(SavedQueryList);
