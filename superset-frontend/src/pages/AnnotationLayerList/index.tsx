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

import { useMemo, useState } from 'react';
import rison from 'rison';
import { t, SupersetClient } from '@superset-ui/core';
import { Link, useHistory } from 'react-router-dom';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { Typography } from '@superset-ui/core/components/Typography';

import { DeleteModal, ConfirmStatusChange } from '@superset-ui/core/components';
import {
  ModifiedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  ListViewActionsBar,
  type ListViewActionProps,
  type ListViewProps,
  type ListViewFilters,
} from 'src/components';
import AnnotationLayerModal from 'src/features/annotationLayers/AnnotationLayerModal';
import { AnnotationLayerObject } from 'src/features/annotationLayers/types';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import { Icons } from '@superset-ui/core/components/Icons';
import { navigateTo } from 'src/utils/navigationUtils';
import { WIDER_DROPDOWN_WIDTH } from 'src/components/ListView/utils';

const PAGE_SIZE = 25;

interface AnnotationLayersListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function AnnotationLayersList({
  addDangerToast,
  addSuccessToast,
  user,
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
    t('Annotation layers'),
    addDangerToast,
  );

  const [annotationLayerModalOpen, setAnnotationLayerModalOpen] =
    useState<boolean>(false);
  const [currentAnnotationLayer, setCurrentAnnotationLayer] =
    useState<AnnotationLayerObject | null>(null);

  const [layerCurrentlyDeleting, setLayerCurrentlyDeleting] =
    useState<AnnotationLayerObject | null>(null);

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

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');

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
            return <Link to={`/annotationlayer/${id}/annotation`}>{name}</Link>;
          }

          return (
            <Typography.Link href={`/annotationlayer/${id}/annotation`}>
              {name}
            </Typography.Link>
          );
        },
        size: 'xxl',
        id: 'name',
      },
      {
        accessor: 'descr',
        Header: t('Description'),
        size: 'xl',
        id: 'descr',
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: any) => <ModifiedInfo date={changedOn} user={changedBy} />,
        Header: t('Last modified'),
        accessor: 'changed_on',
        size: 'xl',
        id: 'changed_on',
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
                  icon: 'EditOutlined',
                  onClick: handleEdit,
                }
              : null,
            canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete template'),
                  placement: 'bottom',
                  icon: 'DeleteOutlined',
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => !!item);

          return (
            <ListViewActionsBar actions={actions as ListViewActionProps[]} />
          );
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        hidden: !canEdit && !canDelete,
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
        id: QueryObjectColumns.ChangedBy,
      },
    ],
    [canDelete, canCreate],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  if (canCreate) {
    subMenuButtons.push({
      icon: <Icons.PlusOutlined iconSize="m" />,
      name: t('Annotation layer'),
      buttonStyle: 'primary',
      onClick: () => {
        handleAnnotationLayerEdit(null);
      },
    });
  }

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Changed by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'annotation_layer',
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
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
    ],
    [],
  );

  const emptyState = {
    title: t('No annotation layers yet'),
    image: 'filter-results.svg',
    buttonAction: () => handleAnnotationLayerEdit(null),
    buttonText: t('Annotation layer'),
    buttonIcon: <Icons.PlusOutlined iconSize="m" />,
  };

  const onLayerAdd = (id?: number) => {
    navigateTo(`/annotationlayer/${id}/annotation`);
  };

  const onModalHide = () => {
    refreshData();
    setAnnotationLayerModalOpen(false);
  };

  return (
    <>
      <SubMenu name={t('Annotation layers')} buttons={subMenuButtons} />
      <AnnotationLayerModal
        addDangerToast={addDangerToast}
        layer={currentAnnotationLayer}
        onLayerAdd={onLayerAdd}
        onHide={onModalHide}
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
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              emptyState={emptyState}
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AnnotationLayersList);
