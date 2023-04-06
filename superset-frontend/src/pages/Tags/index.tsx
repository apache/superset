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
import { FeatureFlag, t } from '@superset-ui/core';
import React, { useMemo, useCallback } from 'react';
import { isFeatureEnabled } from 'src/featureFlags';
import {
  createFetchRelated,
  createErrorHandler,
  Actions,
} from 'src/views/CRUD/utils';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import { dangerouslyGetItemDoNotUse } from 'src/utils/localStorageHelpers';
import withToasts from 'src/components/MessageToasts/withToasts';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import FacePile from 'src/components/FacePile';
import { Link } from 'react-router-dom';
import { deleteTags } from 'src/features/tags/tags';
import { Tag as AntdTag } from 'antd';
import { Tag } from 'src/views/CRUD/types';
import TagCard from 'src/features/tags/TagCard';

const PAGE_SIZE = 25;

interface TagListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function TagList(props: TagListProps) {
  const {
    addDangerToast,
    addSuccessToast,
    user: { userId },
  } = props;

  const {
    state: {
      loading,
      resourceCount: tagCount,
      resourceCollection: tags,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<Tag>('tag', t('tag'), addDangerToast);

  // TODO: Fix usage of localStorage keying on the user id
  const userKey = dangerouslyGetItemDoNotUse(userId?.toString(), null);

  const canDelete = hasPerm('can_write');

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  function handleTagsDelete(
    tags: Tag[],
    callback: (text: string) => void,
    error: (text: string) => void,
  ) {
    // TODO what permissions need to be checked here?
    deleteTags(tags, callback, error);
    refreshData();
  }

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { name: tagName },
          },
        }: any) => (
          <AntdTag>
            <Link to={`/superset/all_entities/?tags=${tagName}`}>
              {tagName}
            </Link>
          </AntdTag>
        ),
        Header: t('Name'),
        accessor: 'name',
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
            original: { created_by: createdBy },
          },
        }: any) => (createdBy ? <FacePile users={[createdBy]} /> : ''),
        Header: t('Created by'),
        accessor: 'created_by',
        disableSortBy: true,
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () =>
            handleTagsDelete([original], addSuccessToast, addDangerToast);
          return (
            <Actions className="actions">
              {canDelete && (
                <ConfirmStatusChange
                  title={t('Please confirm')}
                  description={
                    <>
                      {t('Are you sure you want to delete')}{' '}
                      <b>{original.dashboard_title}</b>?
                    </>
                  }
                  onConfirm={handleDelete}
                >
                  {confirmDelete => (
                    <Tooltip
                      id="delete-action-tooltip"
                      title={t('Delete')}
                      placement="bottom"
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        className="action-button"
                        onClick={confirmDelete}
                      >
                        <Icons.Trash data-test="dashboard-list-trash-icon" />
                      </span>
                    </Tooltip>
                  )}
                </ConfirmStatusChange>
              )}
            </Actions>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canDelete,
        disableSortBy: true,
      },
    ],
    [userId, canDelete, refreshData, addSuccessToast, addDangerToast],
  );

  const filters: Filters = useMemo(() => {
    const filters_list = [
      {
        Header: t('Created by'),
        id: 'created_by',
        input: 'select',
        operator: FilterOperator.relationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'tag',
          'created_by',
          createErrorHandler(errMsg =>
            addDangerToast(
              t(
                'An error occurred while fetching tag created by values: %s',
                errMsg,
              ),
            ),
          ),
          props.user,
        ),
        paginate: true,
      },
      {
        Header: t('Search'),
        id: 'name',
        input: 'search',
        operator: FilterOperator.contains,
      },
    ] as Filters;
    return filters_list;
  }, [addDangerToast, props.user]);

  const sortTypes = [
    {
      desc: false,
      id: 'name',
      label: t('Alphabetical'),
      value: 'alphabetical',
    },
    {
      desc: true,
      id: 'changed_on_delta_humanized',
      label: t('Recently modified'),
      value: 'recently_modified',
    },
    {
      desc: false,
      id: 'changed_on_delta_humanized',
      label: t('Least recently modified'),
      value: 'least_recently_modified',
    },
  ];

  const renderCard = useCallback(
    (tag: Tag) => (
      <TagCard
        tag={tag}
        hasPerm={hasPerm}
        bulkSelectEnabled={bulkSelectEnabled}
        refreshData={refreshData}
        showThumbnails={
          userKey
            ? userKey.thumbnails
            : isFeatureEnabled(FeatureFlag.THUMBNAILS)
        }
        userId={userId}
        loading={loading}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
    ),
    [
      addDangerToast,
      addSuccessToast,
      bulkSelectEnabled,
      hasPerm,
      loading,
      userId,
      refreshData,
      userKey,
    ],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];
  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      'data-test': 'bulk-select',
      onClick: toggleBulkSelect,
    });
  }

  const handleBulkDelete = (tagsToDelete: Tag[]) =>
    handleTagsDelete(tagsToDelete, addSuccessToast, addDangerToast);

  return (
    <>
      <SubMenu name={t('Tags')} buttons={subMenuButtons} />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected tags?')}
        onConfirm={handleBulkDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canDelete) {
            bulkActions.push({
              key: 'delete',
              name: t('Delete'),
              type: 'danger',
              onSelect: confirmDelete,
            });
          }
          return (
            <>
              <ListView<Tag>
                bulkActions={bulkActions}
                bulkSelectEnabled={bulkSelectEnabled}
                cardSortSelectOptions={sortTypes}
                className="dashboard-list-view"
                columns={columns}
                count={tagCount}
                data={tags.filter(tag => !tag.name.includes(':'))}
                disableBulkSelect={toggleBulkSelect}
                fetchData={fetchData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                pageSize={PAGE_SIZE}
                showThumbnails={
                  userKey
                    ? userKey.thumbnails
                    : isFeatureEnabled(FeatureFlag.THUMBNAILS)
                }
                renderCard={renderCard}
                defaultViewMode={
                  isFeatureEnabled(FeatureFlag.LISTVIEWS_DEFAULT_CARD_VIEW)
                    ? 'card'
                    : 'table'
                }
              />
            </>
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(TagList);
