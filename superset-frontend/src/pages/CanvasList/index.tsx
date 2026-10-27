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
import { Link, useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { SubjectPile } from 'src/features/subjects/SubjectPile';
import {
  CertifiedBadge,
  ConfirmStatusChange,
  DeleteModal,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  ListView,
  ListViewActionsBar,
  ListViewFilterOperator as FilterOperator,
  ModifiedInfo,
  type ListViewActionProps,
  type ListViewFilters,
  type ListViewProps,
} from 'src/components';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import { CanvasObject } from 'src/features/canvas/types';

const PAGE_SIZE = 25;

interface CanvasListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function CanvasList({
  addDangerToast,
  addSuccessToast,
  user,
}: CanvasListProps) {
  const history = useHistory();
  const {
    state: {
      loading,
      resourceCount: canvasCount,
      resourceCollection: canvases,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<CanvasObject>(
    'canvas',
    t('canvases'),
    addDangerToast,
    true,
    [],
    undefined,
    true,
    undefined,
    true,
  );
  const [canvasDeleting, setCanvasDeleting] = useState<CanvasObject | null>(
    null,
  );
  const canWrite = hasPerm('can_write');

  const createCanvas = () => {
    SupersetClient.post({
      endpoint: '/api/v1/canvas/',
      jsonPayload: { title: t('Untitled canvas') },
    }).then(
      ({ json }) => history.push(`/canvas/${json.id}/`),
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue creating the canvas: %s', errMsg)),
      ),
    );
  };

  const deleteCanvas = ({ id, title }: CanvasObject) => {
    SupersetClient.delete({ endpoint: `/api/v1/canvas/${id}` }).then(
      () => {
        refreshData();
        setCanvasDeleting(null);
        addSuccessToast(t('Deleted: %s', title));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', title, errMsg)),
      ),
    );
  };

  const bulkDeleteCanvases = (toDelete: CanvasObject[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/canvas/?q=${rison.encode(toDelete.map(({ id }) => id))}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected canvases: %s', errMsg),
        ),
      ),
    );
  };

  const initialSort = [{ id: 'changed_on', desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: {
              url,
              title,
              certified_by: certifiedBy,
              certification_details: certificationDetails,
            },
          },
        }: any) => (
          <Link to={url}>
            {certifiedBy && (
              <>
                <CertifiedBadge
                  certifiedBy={certifiedBy}
                  details={certificationDetails}
                />{' '}
              </>
            )}
            {title}
          </Link>
        ),
        Header: t('Title'),
        accessor: 'title',
        size: 'xxl',
        id: 'title',
      },
      {
        Cell: ({
          row: {
            original: { editors = [] },
          },
        }: any) => <SubjectPile subjects={editors} />,
        Header: t('Editors'),
        accessor: 'editors',
        disableSortBy: true,
        size: 'lg',
        id: 'editors',
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
          const actions: ListViewActionProps[] = [
            {
              label: 'delete-action',
              tooltip: t('Delete canvas'),
              placement: 'bottom',
              icon: 'DeleteOutlined',
              onClick: () => setCanvasDeleting(original),
            },
          ];
          return <ListViewActionsBar actions={actions} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        hidden: !canWrite,
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
        id: QueryObjectColumns.ChangedBy,
      },
    ],
    [canWrite],
  );

  const menuData: SubMenuProps = { name: t('Canvases') };
  const subMenuButtons: SubMenuProps['buttons'] = [];
  if (canWrite) {
    subMenuButtons.push(
      {
        name: t('Bulk select'),
        onClick: toggleBulkSelect,
        buttonStyle: 'secondary',
      },
      {
        name: t('Canvas'),
        buttonStyle: 'primary',
        icon: <Icons.PlusOutlined iconSize="m" />,
        onClick: createCanvas,
      },
    );
  }
  menuData.buttons = subMenuButtons;

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Search'),
        key: 'search',
        id: 'title',
        input: 'search',
        operator: FilterOperator.CanvasAllText,
      },
      {
        Header: t('Modified by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'canvas',
          'changed_by',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching modifiers: %s', errMsg),
          ),
          user,
        ),
        paginate: true,
      },
    ],
    [],
  );

  return (
    <>
      <SubMenu {...menuData} />
      {canvasDeleting && (
        <DeleteModal
          description={t(
            'This deletes the canvas for everyone. The widgets on it are not deleted.',
          )}
          onConfirm={() => deleteCanvas(canvasDeleting)}
          onHide={() => setCanvasDeleting(null)}
          open
          title={t('Delete canvas?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected canvases?',
        )}
        onConfirm={bulkDeleteCanvases}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = canWrite
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
            <ListView<CanvasObject>
              className="canvas-list-view"
              columns={columns}
              count={canvasCount}
              data={canvases}
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
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(CanvasList);
