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

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, Link, useHistory } from 'react-router-dom';
import { t, styled, SupersetClient } from '@superset-ui/core';
import moment from 'moment';
import rison from 'rison';

import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import Button from 'src/components/Button';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DeleteModal from 'src/components/DeleteModal';
import ListView, { ListViewProps } from 'src/components/ListView';
import SubMenu, { SubMenuProps } from 'src/views/components/SubMenu';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';

import { AnnotationObject } from './types';
import AnnotationModal from './AnnotationModal';

const PAGE_SIZE = 25;

interface AnnotationListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function AnnotationList({
  addDangerToast,
  addSuccessToast,
}: AnnotationListProps) {
  const { annotationLayerId }: any = useParams();
  const {
    state: {
      loading,
      resourceCount: annotationsCount,
      resourceCollection: annotations,
      bulkSelectEnabled,
    },
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<AnnotationObject>(
    `annotation_layer/${annotationLayerId}/annotation`,
    t('annotation'),
    addDangerToast,
    false,
  );
  const [annotationModalOpen, setAnnotationModalOpen] =
    useState<boolean>(false);
  const [annotationLayerName, setAnnotationLayerName] = useState<string>('');
  const [currentAnnotation, setCurrentAnnotation] =
    useState<AnnotationObject | null>(null);
  const [annotationCurrentlyDeleting, setAnnotationCurrentlyDeleting] =
    useState<AnnotationObject | null>(null);
  const handleAnnotationEdit = (annotation: AnnotationObject | null) => {
    setCurrentAnnotation(annotation);
    setAnnotationModalOpen(true);
  };

  const fetchAnnotationLayer = useCallback(
    async function fetchAnnotationLayer() {
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/annotation_layer/${annotationLayerId}`,
        });
        setAnnotationLayerName(response.json.result.name);
      } catch (response) {
        await getClientErrorObject(response).then(({ error }: any) => {
          addDangerToast(error.error || error.statusText || error);
        });
      }
    },
    [annotationLayerId],
  );

  const handleAnnotationDelete = ({ id, short_descr }: AnnotationObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/annotation_layer/${annotationLayerId}/annotation/${id}`,
    }).then(
      () => {
        refreshData();
        setAnnotationCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', short_descr));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', short_descr, errMsg),
        ),
      ),
    );
  };

  const handleBulkAnnotationsDelete = (
    annotationsToDelete: AnnotationObject[],
  ) => {
    SupersetClient.delete({
      endpoint: `/api/v1/annotation_layer/${annotationLayerId}/annotation/?q=${rison.encode(
        annotationsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected annotations: %s', errMsg),
        ),
      ),
    );
  };

  // get the Annotation Layer
  useEffect(() => {
    fetchAnnotationLayer();
  }, [fetchAnnotationLayer]);

  const initialSort = [{ id: 'short_descr', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'short_descr',
        Header: t('Label'),
      },
      {
        accessor: 'long_descr',
        Header: t('Description'),
      },
      {
        Cell: ({
          row: {
            original: { start_dttm: startDttm },
          },
        }: any) => moment(new Date(startDttm)).format('ll'),
        Header: t('Start'),
        accessor: 'start_dttm',
      },
      {
        Cell: ({
          row: {
            original: { end_dttm: endDttm },
          },
        }: any) => moment(new Date(endDttm)).format('ll'),
        Header: t('End'),
        accessor: 'end_dttm',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => handleAnnotationEdit(original);
          const handleDelete = () => setAnnotationCurrentlyDeleting(original);
          const actions = [
            {
              label: 'edit-action',
              tooltip: t('Edit annotation'),
              placement: 'bottom',
              icon: 'Edit',
              onClick: handleEdit,
            },
            {
              label: 'delete-action',
              tooltip: t('Delete annotation'),
              placement: 'bottom',
              icon: 'Trash',
              onClick: handleDelete,
            },
          ];
          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [true, true],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  subMenuButtons.push({
    name: (
      <>
        <i className="fa fa-plus" /> {t('Annotation')}
      </>
    ),
    buttonStyle: 'primary',
    onClick: () => {
      handleAnnotationEdit(null);
    },
  });

  subMenuButtons.push({
    name: t('Bulk select'),
    onClick: toggleBulkSelect,
    buttonStyle: 'secondary',
    'data-test': 'annotation-bulk-select',
  });

  const StyledHeader = styled.div`
    display: flex;
    flex-direction: row;

    a,
    Link {
      margin-left: 16px;
      font-size: 12px;
      font-weight: normal;
      text-decoration: underline;
    }
  `;

  let hasHistory = true;

  try {
    useHistory();
  } catch (err) {
    // If error is thrown, we know not to use <Link> in render
    hasHistory = false;
  }

  const EmptyStateButton = (
    <Button
      buttonStyle="primary"
      onClick={() => {
        handleAnnotationEdit(null);
      }}
    >
      <>
        <i className="fa fa-plus" /> {t('Annotation')}
      </>
    </Button>
  );

  const emptyState = {
    message: t('No annotation yet'),
    slot: EmptyStateButton,
  };

  return (
    <>
      <SubMenu
        name={
          <StyledHeader>
            <span>{t(`Annotation Layer ${annotationLayerName}`)}</span>
            <span>
              {hasHistory ? (
                <Link to="/annotationlayermodelview/list/">Back to all</Link>
              ) : (
                <a href="/annotationlayermodelview/list/">Back to all</a>
              )}
            </span>
          </StyledHeader>
        }
        buttons={subMenuButtons}
      />
      <AnnotationModal
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        annotation={currentAnnotation}
        show={annotationModalOpen}
        onAnnotationAdd={() => refreshData()}
        annnotationLayerId={annotationLayerId}
        onHide={() => setAnnotationModalOpen(false)}
      />
      {annotationCurrentlyDeleting && (
        <DeleteModal
          description={t(
            `Are you sure you want to delete ${annotationCurrentlyDeleting?.short_descr}?`,
          )}
          onConfirm={() => {
            if (annotationCurrentlyDeleting) {
              handleAnnotationDelete(annotationCurrentlyDeleting);
            }
          }}
          onHide={() => setAnnotationCurrentlyDeleting(null)}
          open
          title={t('Delete Annotation?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected annotations?',
        )}
        onConfirm={handleBulkAnnotationsDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [
            {
              key: 'delete',
              name: t('Delete'),
              onSelect: confirmDelete,
              type: 'danger',
            },
          ];

          return (
            <ListView<AnnotationObject>
              className="annotations-list-view"
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              columns={columns}
              count={annotationsCount}
              data={annotations}
              disableBulkSelect={toggleBulkSelect}
              emptyState={emptyState}
              fetchData={fetchData}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AnnotationList);
