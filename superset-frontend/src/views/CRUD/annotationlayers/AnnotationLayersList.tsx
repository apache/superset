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
import rison from 'rison';
import { t, SupersetClient } from '@superset-ui/core';
import { Link, useHistory } from 'react-router-dom';
import moment from 'moment';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import { IconName } from 'src/components/Icon';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ListView, { ListViewProps, Filters } from 'src/components/ListView';
import Button from 'src/components/Button';
import DeleteModal from 'src/components/DeleteModal';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import AnnotationLayerModal from './AnnotationLayerModal';
import { AnnotationLayerObject } from './types';

const PAGE_SIZE = 25;
const MOMENT_FORMAT = 'MMM DD, YYYY';

interface AnnotationLayersListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function AnnotationLayersList({
  addDangerToast,
  addSuccessToast,
}: AnnotationLayersListProps) {
  const {
    state: {
      loading,
      resourceCount: layersCount,
      resourceCollection: layers,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<AnnotationLayerObject>(
    'annotation_layer',
    t('annotation layers'),
    addDangerToast,
  );

  const [annotationLayerModalOpen, setAnnotationLayerModalOpen] = useState<
    boolean
  >(false);
  const [
    currentAnnotationLayer,
    setCurrentAnnotationLayer,
  ] = useState<AnnotationLayerObject | null>(null);

  const [
    layerCurrentlyDeleting,
    setLayerCurrentlyDeleting,
  ] = useState<AnnotationLayerObject | null>(null);

  const handleLayerDelete = ({ id, name }: AnnotationLayerObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/annotation_layer/${id}`,
    }).then(
      () => {
        refreshData();
        setLayerCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', name, errMsg)),
      ),
    );
  };

  const handleBulkLayerDelete = (layersToDelete: AnnotationLayerObject[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/annotation_layer/?q=${rison.encode(
        layersToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected layers: %s', errMsg),
        ),
      ),
    );
  };

  const canCreate = hasPerm('can_add');
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');

  function handleAnnotationLayerEdit(layer: AnnotationLayerObject | null) {
    setCurrentAnnotationLayer(layer);
    setAnnotationLayerModalOpen(true);
  }

  const initialSort = [{ id: 'name', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        Cell: ({
          row: {
            original: { id, name },
          },
        }: any) => {
          let hasHistory = true;

          try {
            useHistory();
          } catch (err) {
            // If error is thrown, we know not to use <Link> in render
            hasHistory = false;
          }

          if (hasHistory) {
            return (
              <Link to={`/annotationmodelview/${id}/annotation`}>{name}</Link>
            );
          }

          return <a href={`/annotationmodelview/${id}/annotation`}>{name}</a>;
        },
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
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => handleAnnotationLayerEdit(original);
          const handleDelete = () => setLayerCurrentlyDeleting(original);

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

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk Select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Created By'),
        id: 'created_by',
        input: 'select',
        operator: 'rel_o_m',
        unfilteredLabel: 'All',
        fetchSelects: createFetchRelated(
          'annotation_layer',
          'created_by',
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
        Header: t('Search'),
        id: 'name',
        input: 'search',
        operator: 'ct',
      },
    ],
    [],
  );

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
    message: t('No annotation layers yet'),
    slot: EmptyStateButton,
  };

  const onLayerAdd = (id?: number) => {
    window.location.href = `/annotationmodelview/${id}/annotation`;
  };

  return (
    <>
      <SubMenu name={t('Annotation Layers')} buttons={subMenuButtons} />
      <AnnotationLayerModal
        addDangerToast={addDangerToast}
        layer={currentAnnotationLayer}
        onLayerAdd={onLayerAdd}
        onHide={() => setAnnotationLayerModalOpen(false)}
        show={annotationLayerModalOpen}
      />
      {layerCurrentlyDeleting && (
        <DeleteModal
          description={t('This action will permanently delete the layer.')}
          onConfirm={() => {
            if (layerCurrentlyDeleting) {
              handleLayerDelete(layerCurrentlyDeleting);
            }
          }}
          onHide={() => setLayerCurrentlyDeleting(null)}
          open
          title={t('Delete Layer?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected layers?')}
        onConfirm={handleBulkLayerDelete}
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
            <ListView<AnnotationLayerObject>
              className="annotation-layers-list-view"
              columns={columns}
              count={layersCount}
              data={layers}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              emptyState={emptyState}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AnnotationLayersList);
