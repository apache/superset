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
import { useParams } from 'react-router-dom';
import { t, SupersetClient } from '@superset-ui/core';
import moment from 'moment';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ListView from 'src/components/ListView';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import getClientErrorObject from 'src/utils/getClientErrorObject';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { IconName } from 'src/components/Icon';
import { useListViewResource } from 'src/views/CRUD/hooks';

import { AnnotationObject } from './types';
import AnnotationModal from './AnnotationModal';

const PAGE_SIZE = 25;

interface AnnotationListProps {
  addDangerToast: (msg: string) => void;
}

function AnnotationList({ addDangerToast }: AnnotationListProps) {
  const { annotationLayerId }: any = useParams();
  const {
    state: {
      loading,
      resourceCount: annotationsCount,
      resourceCollection: annotations,
    },
    fetchData,
    refreshData,
  } = useListViewResource<AnnotationObject>(
    `annotation_layer/${annotationLayerId}/annotation`,
    t('annotation'),
    addDangerToast,
    false,
  );
  const [annotationModalOpen, setAnnotationModalOpen] = useState<boolean>(
    false,
  );
  const [annotationLayerName, setAnnotationLayerName] = useState<string>('');
  const [
    currentAnnotation,
    setCurrentAnnotation,
  ] = useState<AnnotationObject | null>(null);

  const handleAnnotationEdit = (annotation: AnnotationObject) => {
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

  // get the owners of this slice
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
          const handleDelete = () => {}; // openDatabaseDeleteModal(original);
          const actions = [
            {
              label: 'edit-action',
              tooltip: t('Edit Annotation'),
              placement: 'bottom',
              icon: 'edit' as IconName,
              onClick: handleEdit,
            },
            {
              label: 'delete-action',
              tooltip: t('Delete Annotation'),
              placement: 'bottom',
              icon: 'trash' as IconName,
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
      setCurrentAnnotation(null);
      setAnnotationModalOpen(true);
    },
  });

  return (
    <>
      <SubMenu
        name={t(`Annotation Layer ${annotationLayerName}`)}
        buttons={subMenuButtons}
      />
      <AnnotationModal
        addDangerToast={addDangerToast}
        annotation={currentAnnotation}
        show={annotationModalOpen}
        onAnnotationAdd={() => refreshData()}
        annnotationLayerId={annotationLayerId}
        onHide={() => setAnnotationModalOpen(false)}
      />
      <ListView<AnnotationObject>
        className="css-templates-list-view"
        columns={columns}
        count={annotationsCount}
        data={annotations}
        fetchData={fetchData}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}

export default withToasts(AnnotationList);
