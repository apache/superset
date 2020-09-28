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
import React, { useState, useMemo } from 'react';
import moment from 'moment';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
} from 'src/views/CRUD/utils';
import { Popover } from 'src/common/components';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import ListView, { Filters } from 'src/components/ListView';
import DeleteModal from 'src/components/DeleteModal';
import TooltipWrapper from 'src/components/TooltipWrapper';
import Icon from 'src/components/Icon';
import { commonMenuData } from 'src/views/CRUD/data/common';

const PAGE_SIZE = 25;

interface SavedQueryListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

type SavedQueryObject = {
  id: number;
  label: string;
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
    state: { loading, resourceCount: queryCount, resourceCollection: queries },
    hasPerm,
    fetchData,
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

  const canCreate = hasPerm('can_add');
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');

  const menuData: SubMenuProps = {
    activeChild: 'Saved Queries',
    ...commonMenuData,
  };

  // Action methods
  const openInSqlLab = function (id: number) {
    window.open(`${window.location.origin}/superset/sqllab?savedQueryId=${id}`);
  };

  const copyQueryLink = function (id: number) {
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
  };

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
      },
      {
        accessor: 'database',
        hidden: true,
        disableSortBy: true,
        Cell: ({
          row: {
            original: { database },
          },
        }: any) => `${database.database_name}`,
      },
      {
        accessor: 'schema',
        Header: t('Schema'),
      },
      {
        Cell: ({
          row: {
            original: { sql_tables: tables },
          },
        }: any) => {
          const names = tables.map((table: any) => table.table);
          const main = names.shift();

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
      },
      {
        Cell: ({
          row: {
            original: { changed_on_delta_humanized: changedOn },
          },
        }: any) => changedOn,
        Header: t('Modified'),
        accessor: 'changed_on_delta_humanized',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handlePreview = () => {}; // openQueryPreviewModal(original); // TODO: open preview modal
          const handleEdit = () => {
            openInSqlLab(original.id);
          };
          const handleCopy = () => {
            copyQueryLink(original.id);
          };
          const handleDelete = () => setQueryCurrentlyDeleting(original); // openQueryDeleteModal(original);

          return (
            <span className="actions">
              <TooltipWrapper
                label="preview-action"
                tooltip={t('Query preview')}
                placement="bottom"
              >
                <span
                  role="button"
                  tabIndex={0}
                  className="action-button"
                  onClick={handlePreview}
                >
                  <Icon name="binoculars" />
                </span>
              </TooltipWrapper>
              {canEdit && (
                <TooltipWrapper
                  label="edit-action"
                  tooltip={t('Edit query')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleEdit}
                  >
                    <Icon name="edit" />
                  </span>
                </TooltipWrapper>
              )}
              <TooltipWrapper
                label="copy-action"
                tooltip={t('Copy query URL')}
                placement="bottom"
              >
                <span
                  role="button"
                  tabIndex={0}
                  className="action-button"
                  onClick={handleCopy}
                >
                  <Icon name="copy" />
                </span>
              </TooltipWrapper>
              {canDelete && (
                <span
                  role="button"
                  tabIndex={0}
                  className="action-button"
                  data-test="database-delete"
                  onClick={handleDelete}
                >
                  <TooltipWrapper
                    label="delete-action"
                    tooltip={t('Delete query')}
                    placement="bottom"
                  >
                    <Icon name="trash" />
                  </TooltipWrapper>
                </span>
              )}
            </span>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [canDelete, canCreate],
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
            'This action will permanently delete the selected saved queries.',
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
      />
    </>
  );
}

export default withToasts(SavedQueryList);
