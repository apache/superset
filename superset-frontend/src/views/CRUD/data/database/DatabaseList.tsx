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
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import DeleteModal from 'src/components/DeleteModal';
import TooltipWrapper from 'src/components/TooltipWrapper';
import Icon from 'src/components/Icon';
import ListView, { Filters } from 'src/components/ListView';
import { commonMenuData } from 'src/views/CRUD/data/common';
import DatabaseModal from './DatabaseModal';
import { DatabaseObject } from './types';

const PAGE_SIZE = 25;

interface DatabaseDeleteObject extends DatabaseObject {
  chart_count: number;
  dashboard_count: number;
}
interface DatabaseListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const IconBlack = styled(Icon)`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

function BooleanDisplay({ value }: { value: Boolean }) {
  return value ? <IconBlack name="check" /> : <IconBlack name="cancel-x" />;
}

function DatabaseList({ addDangerToast, addSuccessToast }: DatabaseListProps) {
  const {
    state: {
      loading,
      resourceCount: databaseCount,
      resourceCollection: databases,
    },
    hasPerm,
    fetchData,
    refreshData,
  } = useListViewResource<DatabaseObject>(
    'database',
    t('database'),
    addDangerToast,
  );
  const [databaseModalOpen, setDatabaseModalOpen] = useState<boolean>(false);
  const [
    databaseCurrentlyDeleting,
    setDatabaseCurrentlyDeleting,
  ] = useState<DatabaseDeleteObject | null>(null);
  const [currentDatabase, setCurrentDatabase] = useState<DatabaseObject | null>(
    null,
  );

  const openDatabaseDeleteModal = (database: DatabaseObject) =>
    SupersetClient.get({
      endpoint: `/api/v1/database/${database.id}/related_objects/`,
    })
      .then(({ json = {} }) => {
        setDatabaseCurrentlyDeleting({
          ...database,
          chart_count: json.charts.count,
          dashboard_count: json.dashboards.count,
        });
      })
      .catch(
        createErrorHandler(errMsg =>
          t(
            'An error occurred while fetching database related data: %s',
            errMsg,
          ),
        ),
      );

  function handleDatabaseDelete({ id, database_name: dbName }: DatabaseObject) {
    SupersetClient.delete({
      endpoint: `/api/v1/database/${id}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t('Deleted: %s', dbName));

        // Close delete modal
        setDatabaseCurrentlyDeleting(null);
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', dbName, errMsg)),
      ),
    );
  }

  function handleDatabaseEdit(database: DatabaseObject) {
    // Set database and open modal
    setCurrentDatabase(database);
    setDatabaseModalOpen(true);
  }

  const canCreate = hasPerm('can_add');
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');

  const menuData: SubMenuProps = {
    activeChild: 'Databases',
    ...commonMenuData,
  };

  if (canCreate) {
    menuData.buttons = [
      {
        name: (
          <>
            {' '}
            <i className="fa fa-plus" /> {t('Database')}{' '}
          </>
        ),
        buttonStyle: 'primary',
        onClick: () => {
          // Ensure modal will be opened in add mode
          setCurrentDatabase(null);
          setDatabaseModalOpen(true);
        },
      },
    ];
  }

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'database_name',
        Header: t('Database'),
      },
      {
        accessor: 'backend',
        Header: t('Backend'),
        size: 'xxl',
        disableSortBy: true, // TODO: api support for sorting by 'backend'
      },
      {
        accessor: 'allow_run_async',
        Header: (
          <TooltipWrapper
            label="allow-run-async-header"
            tooltip={t('Asynchronous Query Execution')}
            placement="top"
          >
            <span>{t('AQE')}</span>
          </TooltipWrapper>
        ),
        Cell: ({
          row: {
            original: { allow_run_async: allowRunAsync },
          },
        }: any) => <BooleanDisplay value={allowRunAsync} />,
        size: 'md',
      },
      {
        accessor: 'allow_dml',
        Header: (
          <TooltipWrapper
            label="allow-dml-header"
            tooltip={t('Allow Data Danipulation Language')}
            placement="top"
          >
            <span>{t('DML')}</span>
          </TooltipWrapper>
        ),
        Cell: ({
          row: {
            original: { allow_dml: allowDML },
          },
        }: any) => <BooleanDisplay value={allowDML} />,
        size: 'md',
      },
      {
        accessor: 'allow_csv_upload',
        Header: t('CSV Upload'),
        Cell: ({
          row: {
            original: { allow_csv_upload: allowCSVUpload },
          },
        }: any) => <BooleanDisplay value={allowCSVUpload} />,
        size: 'xl',
      },
      {
        accessor: 'expose_in_sqllab',
        Header: t('Expose in SQL Lab'),
        Cell: ({
          row: {
            original: { expose_in_sqllab: exposeInSqllab },
          },
        }: any) => <BooleanDisplay value={exposeInSqllab} />,
        size: 'xxl',
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
          const handleEdit = () => handleDatabaseEdit(original);
          const handleDelete = () => openDatabaseDeleteModal(original);
          if (!canEdit && !canDelete) {
            return null;
          }
          return (
            <span className="actions">
              {canEdit && (
                <TooltipWrapper
                  label="edit-action"
                  tooltip={t('Edit')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleEdit}
                  >
                    <Icon name="edit-alt" />
                  </span>
                </TooltipWrapper>
              )}
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
                    tooltip={t('Delete database')}
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
        Header: t('Expose in SQL Lab'),
        id: 'expose_in_sqllab',
        input: 'select',
        operator: 'eq',
        unfilteredLabel: 'All',
        selects: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
      },
      {
        Header: (
          <TooltipWrapper
            label="allow-run-async-filter-header"
            tooltip={t('Asynchronous Query Execution')}
            placement="top"
          >
            <span>{t('AQE')}</span>
          </TooltipWrapper>
        ),
        id: 'allow_run_async',
        input: 'select',
        operator: 'eq',
        unfilteredLabel: 'All',
        selects: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
      },
      {
        Header: t('Search'),
        id: 'database_name',
        input: 'search',
        operator: 'ct',
      },
    ],
    [],
  );

  return (
    <>
      <SubMenu {...menuData} />
      <DatabaseModal
        database={currentDatabase}
        show={databaseModalOpen}
        onHide={() => setDatabaseModalOpen(false)}
        onDatabaseAdd={() => {
          refreshData();
        }}
      />
      {databaseCurrentlyDeleting && (
        <DeleteModal
          description={t(
            'The database %s is linked to %s charts that appear on %s dashboards. Are you sure you want to continue? Deleting the database will break those objects.',
            databaseCurrentlyDeleting.database_name,
            databaseCurrentlyDeleting.chart_count,
            databaseCurrentlyDeleting.dashboard_count,
          )}
          onConfirm={() => {
            if (databaseCurrentlyDeleting) {
              handleDatabaseDelete(databaseCurrentlyDeleting);
            }
          }}
          onHide={() => setDatabaseCurrentlyDeleting(null)}
          open
          title={t('Delete Database?')}
        />
      )}

      <ListView<DatabaseObject>
        className="database-list-view"
        columns={columns}
        count={databaseCount}
        data={databases}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}

export default withToasts(DatabaseList);
