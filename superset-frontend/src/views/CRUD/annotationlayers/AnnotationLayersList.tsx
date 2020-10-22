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

import React, { useMemo } from 'react';
// import React, { useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import moment from 'moment';
import { useListViewResource } from 'src/views/CRUD/hooks';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import { IconName } from 'src/components/Icon';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
// import ListView, { Filters } from 'src/components/ListView';
import ListView from 'src/components/ListView';
import Button from 'src/components/Button';

const PAGE_SIZE = 25;
const MOMENT_FORMAT = 'MMM DD, YYYY';

interface AnnotationLayersListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

// TODO: move to separate types file
type CreatedByUser = {
  id: number;
  first_name: string;
  last_name: string;
};

type AnnotationLayerObject = {
  id?: number;
  changed_on_delta_humanized?: string;
  created_on?: string;
  created_by?: CreatedByUser;
  changed_by?: CreatedByUser;
  name?: string;
  desc?: string;
};

function AnnotationLayersList({
  addDangerToast,
  addSuccessToast,
}: AnnotationLayersListProps) {
  const {
    state: { loading, resourceCount: layersCount, resourceCollection: layers },
    hasPerm,
    fetchData,
    // refreshData,
  } = useListViewResource<AnnotationLayerObject>(
    'annotation_layer',
    t('annotation layers'),
    addDangerToast,
  );

  // TODO: un-comment all instances when modal work begins
  /* const [annotationLayerModalOpen, setAnnotationLayerModalOpen] = useState<
    boolean
  >(false);
  const [
    currentAnnotationLayer,
    setCurrentAnnotationLayer,
  ] = useState<AnnotationLayerObject | null>(null); */

  const canCreate = hasPerm('can_add');
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');

  function handleAnnotationLayerEdit(layer: AnnotationLayerObject | null) {
    // setCurrentAnnotationLayer(layer);
    // setAnnotationLayerModalOpen(true);
  }

  const initialSort = [{ id: 'name', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
      },
      {
        accessor: 'descr',
        Header: t('Description'),
      },
      {
        Cell: ({
          row: {
            original: { changed_on: changedOn },
          },
        }: any) => {
          const date = new Date(changedOn);
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

          return moment(utc).format(MOMENT_FORMAT);
        },
        Header: t('Last Modified'),
        accessor: 'changed_on',
        size: 'xl',
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

          return moment(utc).format(MOMENT_FORMAT);
        },
        Header: t('Created On'),
        accessor: 'created_on',
        size: 'xl',
      },
      {
        accessor: 'created_by',
        disableSortBy: true,
        Header: t('Created By'),
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
        Header: t('Last Modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => handleAnnotationLayerEdit(original);
          const handleDelete = () => {}; // openAnnotationLayerDeleteModal(original);

          const actions = [
            canEdit
              ? {
                  label: 'edit-action',
                  tooltip: t('Edit template'),
                  placement: 'bottom',
                  icon: 'edit' as IconName,
                  onClick: handleEdit,
                }
              : null,
            canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete template'),
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
        hidden: !canEdit && !canDelete,
        size: 'xl',
      },
    ],
    [canDelete, canCreate],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCreate) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Annotation Layer')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        handleAnnotationLayerEdit(null);
      },
    });
  }

  const EmptyStateButton = (
    <Button
      buttonStyle="primary"
      onClick={() => {
        handleAnnotationLayerEdit(null);
      }}
    >
      <>
        <i className="fa fa-plus" /> {t('Annotation Layer')}
      </>
    </Button>
  );

  const emptyState = {
    message: 'No annotation layers yet',
    slot: EmptyStateButton,
  };

  return (
    <>
      <SubMenu name={t('Annotation Layers')} buttons={subMenuButtons} />
      <ListView<AnnotationLayerObject>
        className="annotation-layers-list-view"
        columns={columns}
        count={layersCount}
        data={layers}
        fetchData={fetchData}
        // filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
        emptyState={emptyState}
      />
    </>
  );
}

export default withToasts(AnnotationLayersList);
