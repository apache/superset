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

import { t, styled } from '@superset-ui/core';
import React, { useMemo } from 'react';
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
import TooltipWrapper from 'src/components/TooltipWrapper';
import Icon from 'src/components/Icon';
import { commonMenuData } from 'src/views/CRUD/data/common';

const PAGE_SIZE = 25;

interface SavedQueryListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

type SavedQueryObject = {};

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
    // refreshData, //TODO: add back later when editing?
  } = useListViewResource<SavedQueryObject>(
    'saved_query',
    t('saved_queries'),
    addDangerToast,
  );

  const canCreate = hasPerm('can_add');
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');

  const menuData: SubMenuProps = {
    activeChild: 'Saved Queries',
    ...commonMenuData,
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
          const handleEdit = () => {}; // handleQueryEdit(original); // TODO: navigate to sql editor with selected query open
          const handleCopy = () => {}; // TODO: copy link to clipboard
          const handleDelete = () => {}; // openQueryDeleteModal(original);

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
