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

import { t, SupersetClient } from '@superset-ui/core';
import { useMemo, useCallback } from 'react';
import { ConfirmStatusChange, Tooltip } from '@superset-ui/core/components';
import {
  ModifiedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewFilters,
  type ListViewProps,
} from 'src/components';
import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import AsyncTaskStatusIcon from 'src/features/asyncTasks/AsyncTaskStatusIcon';
import AsyncTaskPayloadPopover from 'src/features/asyncTasks/AsyncTaskPayloadPopover';
import { AsyncTask, TaskStatus } from 'src/features/asyncTasks/types';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';

const PAGE_SIZE = 25;

interface AsyncTaskListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function AsyncTaskList({
  addDangerToast,
  addSuccessToast,
  user,
}: AsyncTaskListProps) {
  const {
    state: {
      loading,
      resourceCount: tasksCount,
      resourceCollection: tasks,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<AsyncTask>(
    'async_task',
    t('async task'),
    addDangerToast,
  );

  const isAdmin = useMemo(() => isUserAdmin(user), [user]);
  const canWrite = hasPerm('can_write');

  const handleTaskAbort = useCallback(
    (task: AsyncTask) => {
      SupersetClient.post({
        endpoint: `/api/v1/async_task/${task.uuid}/abort`,
      }).then(
        () => {
          refreshData();
          addSuccessToast(
            t('Task aborted: %s', task.task_type || task.task_key),
          );
        },
        createErrorHandler(errMsg =>
          addDangerToast(t('There was an issue aborting the task: %s', errMsg)),
        ),
      );
    },
    [addDangerToast, addSuccessToast, refreshData],
  );

  const handleBulkAbort = useCallback(
    (tasks: AsyncTask[]) => {
      const abortableTasks = tasks.filter(
        task =>
          task.status === TaskStatus.Pending ||
          task.status === TaskStatus.InProgress,
      );

      if (abortableTasks.length === 0) {
        addDangerToast(
          t('None of the selected tasks can be aborted (already completed)'),
        );
        return;
      }

      const taskUuids = abortableTasks.map(task => task.uuid);

      SupersetClient.post({
        endpoint: '/api/v1/async_task/bulk_abort',
        jsonPayload: { task_uuids: taskUuids },
      }).then(
        ({ json }) => {
          refreshData();
          toggleBulkSelect();
          const { aborted_count, failed_count } = json;
          if (failed_count > 0) {
            addDangerToast(
              t(
                'Partially aborted: %s of %s tasks aborted successfully',
                aborted_count,
                abortableTasks.length,
              ),
            );
          } else {
            addSuccessToast(
              t('Successfully aborted %s task(s)', aborted_count),
            );
          }
        },
        createErrorHandler(errMsg => {
          addDangerToast(
            t('There was an issue aborting the selected tasks: %s', errMsg),
          );
        }),
      );
    },
    [addDangerToast, addSuccessToast, refreshData, toggleBulkSelect],
  );

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { uuid },
          },
        }: any) => {
          const truncated = `${uuid.slice(0, 8)}...`;
          return (
            <Tooltip title={uuid} placement="top">
              <span>{truncated}</span>
            </Tooltip>
          );
        },
        accessor: 'uuid',
        Header: t('UUID'),
        size: 'md',
        id: 'uuid',
      },
      {
        Cell: ({
          row: {
            original: { task_key },
          },
        }: any) => {
          const truncated =
            task_key.length > 20 ? `${task_key.slice(0, 20)}...` : task_key;
          return (
            <Tooltip title={task_key} placement="top">
              <span>{truncated}</span>
            </Tooltip>
          );
        },
        accessor: 'task_id',
        Header: t('Task ID'),
        size: 'lg',
        id: 'task_id',
      },
      {
        Cell: ({
          row: {
            original: { status, progress },
          },
        }: any) => <AsyncTaskStatusIcon status={status} progress={progress} />,
        accessor: 'status',
        Header: t('Status'),
        size: 'xs',
        id: 'status',
      },
      {
        accessor: 'task_type',
        Header: t('Type'),
        size: 'md',
        id: 'task_type',
      },
      {
        Cell: ({
          row: {
            original: { task_type, task_key },
          },
        }: any) => (
          <Tooltip title={task_key} placement="top">
            <span>{task_type}</span>
          </Tooltip>
        ),
        accessor: 'task_type',
        Header: t('Type'),
        size: 'xxl',
        id: 'task_type',
      },
      {
        Cell: ({
          row: {
            original: { created_by },
          },
        }: any) =>
          created_by
            ? `${created_by.first_name} ${created_by.last_name}`
            : t('System'),
        accessor: 'created_by',
        Header: t('User'),
        size: 'lg',
        id: 'created_by',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: {
              created_on_delta_humanized: createdOn,
              created_by: createdBy,
            },
          },
        }: any) => <ModifiedInfo date={createdOn} user={createdBy} />,
        Header: t('Created'),
        accessor: 'created_on',
        size: 'xl',
        id: 'created_on',
      },
      {
        Cell: ({
          row: {
            original: { duration_seconds },
          },
        }: any) =>
          duration_seconds !== null ? `${Math.round(duration_seconds)}s` : '-',
        accessor: 'duration_seconds',
        Header: t('Duration'),
        size: 'sm',
        id: 'duration_seconds',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { payload },
          },
        }: any) =>
          payload && Object.keys(payload).length > 0 ? (
            <AsyncTaskPayloadPopover payload={payload} />
          ) : null,
        accessor: 'payload',
        Header: t('Details'),
        size: 'xs',
        id: 'payload',
        disableSortBy: true,
      },
      {
        Cell: ({ row: { original } }: any) => {
          const canAbort =
            original.status === TaskStatus.Pending ||
            original.status === TaskStatus.InProgress;

          if (!canAbort) {
            return null;
          }

          const handleAbort = () => handleTaskAbort(original);

          return (
            <ConfirmStatusChange
              title={t('Please confirm')}
              description={
                <>
                  {t('Are you sure you want to abort')}{' '}
                  <b>{original.task_id}</b>?
                </>
              }
              onConfirm={handleAbort}
            >
              {confirmAbort => (
                <Tooltip
                  id="abort-action-tooltip"
                  title={t('Abort')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={confirmAbort}
                  >
                    <Icons.StopOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
            </ConfirmStatusChange>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        size: 'sm',
        disableSortBy: true,
      },
    ],
    [handleTaskAbort],
  );

  const filters: ListViewFilters = useMemo(() => {
    const baseFilters: ListViewFilters = [
      {
        Header: t('Status'),
        key: 'status',
        id: 'status',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Pending'), value: TaskStatus.Pending },
          { label: t('In Progress'), value: TaskStatus.InProgress },
          { label: t('Success'), value: TaskStatus.Success },
          { label: t('Failed'), value: TaskStatus.Failure },
          { label: t('Aborted'), value: TaskStatus.Aborted },
        ],
      },
      {
        Header: t('Task Type'),
        key: 'task_type',
        id: 'task_type',
        input: 'search',
        operator: FilterOperator.Contains,
      },
    ];

    // Only show user filter for admins
    if (isAdmin) {
      baseFilters.push({
        Header: t('User'),
        key: 'created_by',
        id: 'created_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'async_task',
          'created_by',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching creators: %s', errMsg),
          ),
          user,
        ),
        paginate: true,
      });
    }

    return baseFilters;
  }, [isAdmin, user]);

  const initialSort = [{ id: 'created_on', desc: true }];

  const emptyState = {
    title: t('No async tasks yet'),
    image: 'filter-results.svg',
    description: t(
      'Async tasks will appear here as background operations are executed.',
    ),
  };

  const bulkActions: ListViewProps['bulkActions'] = canWrite
    ? [
        {
          key: 'abort',
          name: t('Abort'),
          type: 'secondary',
          onSelect: (tasks: AsyncTask[]) => {
            handleBulkAbort(tasks);
          },
        },
      ]
    : [];

  const subMenuButtons = useMemo(() => {
    if (!canWrite) {
      return [];
    }
    return [
      {
        name: (
          <>
            <Icons.StopOutlined iconSize="l" /> {t('Bulk Select')}
          </>
        ),
        buttonStyle: 'secondary' as const,
        onClick: toggleBulkSelect,
      },
    ];
  }, [canWrite, toggleBulkSelect]);

  return (
    <>
      <SubMenu name={t('Async Tasks')} buttons={subMenuButtons} />
      <ListView<AsyncTask>
        className="async-task-list-view"
        columns={columns}
        count={tasksCount}
        data={tasks}
        emptyState={emptyState}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
        refreshData={refreshData}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        bulkSelectEnabled={bulkSelectEnabled}
        bulkActions={bulkActions}
      />
    </>
  );
}

export default withToasts(AsyncTaskList);
