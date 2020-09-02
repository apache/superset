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
import { SupersetClient } from '@superset-ui/connection';
import styled from '@superset-ui/style';
import { t } from '@superset-ui/translation';
import React, { useState, useMemo } from 'react';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import TooltipWrapper from 'src/components/TooltipWrapper';
import Icon from 'src/components/Icon';
import ListView, { Filters } from 'src/components/ListView';
import { commonMenuData } from 'src/views/CRUD/data/common';
import DatabaseModal from './DatabaseModal';
import { DatabaseObject } from './types';

const PAGE_SIZE = 25;

interface DatabaseListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const IconBlack = styled(Icon)`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

function BooleanDisplay(value: any) {
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
  const [currentDatabase, setCurrentDatabase] = useState<DatabaseObject | null>(
    null,
  );

  function handleDatabaseDelete({ id, database_name: dbName }: DatabaseObject) {
    SupersetClient.delete({
      endpoint: `/api/v1/database/${id}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t('Deleted: %s', dbName));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', dbName, errMsg)),
      ),
    );
  }

  const canCreate = hasPerm('can_add');
  const canDelete = hasPerm('can_delete');

  const menuData: SubMenuProps = {
    activeChild: 'Databases',
    ...commonMenuData,
  };

  if (canCreate) {
    menuData.primaryButton = {
      name: (
        <>
          {' '}
          <i className="fa fa-plus" /> {t('Database')}{' '}
        </>
      ),
      onClick: () => {
        // Ensure modal will be opened in add mode
        setCurrentDatabase(null);
        setDatabaseModalOpen(true);
      },
    };
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
          const handleDelete = () => handleDatabaseDelete(original);
          if (!canDelete) {
            return null;
          }
          return (
            <span className="actions">
              {canDelete && (
                <ConfirmStatusChange
                  title={t('Please Confirm')}
                  description={
                    <>
                      {t('Are you sure you want to delete')}{' '}
                      <b>{original.database_name}</b>?
                    </>
                  }
                  onConfirm={handleDelete}
                >
                  {confirmDelete => (
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      data-test="database-delete"
                      onClick={confirmDelete}
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
                </ConfirmStatusChange>
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

  const filters: Filters = [];

  return (
    <>
      <SubMenu {...menuData} />
      <DatabaseModal
        database={currentDatabase}
        show={databaseModalOpen}
        onHide={() => setDatabaseModalOpen(false)}
        onDatabaseAdd={() => {
          /* TODO: add database logic here */
        }}
      />

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
