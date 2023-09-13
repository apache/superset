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
import React, { useMemo, useState } from 'react';
import { isFeatureEnabled, FeatureFlag, t } from '@superset-ui/core';
import {
  createFetchRelated,
  createErrorHandler,
  Actions,
} from 'src/views/CRUD/utils';
import { useListViewResource, useFavoriteStatus } from 'src/views/CRUD/hooks';
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
import TagModal from 'src/features/tags/TagModal';
import FaveStar from 'src/components/FaveStar';

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

  const [showTagModal, setShowTagModal] = useState<boolean>(false);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const tagIds = useMemo(() => tags.map(c => c.id), [tags]);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'tag',
    tagIds,
    addDangerToast,
  );

  // TODO: Fix usage of localStorage keying on the user id
  const userKey = dangerouslyGetItemDoNotUse(userId?.toString(), null);

  const canDelete = hasPerm('can_write');
  const canEdit = hasPerm('can_write');

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

  const handleTagEdit = (tag: Tag) => {
    setShowTagModal(true);
    setTagToEdit(tag);
  };

  const emptyState = {
    title: t('No Tags created'),
    image: 'dashboard.svg',
    description:
      'Create a new tag and assign it to existing entities like charts or dashboards',
    buttonAction: () => setShowTagModal(true),
    buttonText: (
      <>
        <i className="fa fa-plus" data-test="add-rule-empty" />{' '}
        {'Create a new Tag'}{' '}
      </>
    ),
  };

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { id },
          },
        }: any) =>
          userId && (
            <FaveStar
              itemId={id}
              saveFaveStar={saveFavoriteStatus}
              isStarred={favoriteStatus[id]}
            />
          ),
        Header: '',
        id: 'id',
        disableSortBy: true,
        size: 'xs',
        hidden: !userId,
      },
      {
        Cell: ({
          row: {
            original: { id, name: tagName },
          },
        }: any) => (
          <AntdTag>
            <Link to={`/superset/all_entities/?id=${id}`}>{tagName}</Link>
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
          const handleEdit = () => handleTagEdit(original);
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
              {canEdit && (
                <Tooltip
                  id="edit-action-tooltip"
                  title={t('Edit')}
                  placement="bottom"
                >
                  <span
                    role="button"
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

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      'data-test': 'bulk-select',
      onClick: toggleBulkSelect,
    });
  }

  // render new 'New Tag' btn
  subMenuButtons.push({
    name: (
      <>
        <i className="fa fa-plus" /> {t('Tag')}
      </>
    ),
    buttonStyle: 'primary',
    'data-test': 'bulk-select',
    onClick: () => setShowTagModal(true),
  });

  const handleBulkDelete = (tagsToDelete: Tag[]) =>
    handleTagsDelete(tagsToDelete, addSuccessToast, addDangerToast);

  return (
    <>
      <TagModal
        show={showTagModal}
        onHide={() => {
          setShowTagModal(false);
          setTagToEdit(null);
        }}
        editTag={tagToEdit}
        refreshData={refreshData}
        addSuccessToast={addSuccessToast}
        addDangerToast={addDangerToast}
        clearOnHide
      />
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
                className="tags-list-view"
                columns={columns}
                count={tagCount}
                data={tags.filter(tag => !tag.name.includes(':'))}
                disableBulkSelect={toggleBulkSelect}
                refreshData={refreshData}
                emptyState={emptyState}
                fetchData={fetchData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                addDangerToast={addDangerToast}
                addSuccessToast={addSuccessToast}
                pageSize={PAGE_SIZE}
                showThumbnails={
                  userKey
                    ? userKey.thumbnails
                    : isFeatureEnabled(FeatureFlag.THUMBNAILS)
                }
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
