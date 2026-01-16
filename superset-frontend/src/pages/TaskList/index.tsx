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

import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core';
import { useMemo, useCallback } from 'react';
import {
  ConfirmStatusChange,
  Tooltip,
  Label,
} from '@superset-ui/core/components';
import {
  CreatedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewFilters,
  type ListViewProps,
  FacePile,
} from 'src/components';
import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import TaskStatusIcon from 'src/features/tasks/TaskStatusIcon';
import TaskPayloadPopover from 'src/features/tasks/TaskPayloadPopover';
import TaskStackTracePopover from 'src/features/tasks/TaskStackTracePopover';
import { formatDuration } from 'src/features/tasks/timeUtils';
import { Task, TaskStatus, TaskScope } from 'src/features/tasks/types';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import getBootstrapData from 'src/utils/getBootstrapData';

const PAGE_SIZE = 25;

interface TaskListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function TaskList({ addDangerToast, addSuccessToast, user }: TaskListProps) {
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
  } = useListViewResource<Task>('task', t('task'), addDangerToast);

  const canWrite = hasPerm('can_write');

  // Get full user with roles to check admin status
  const bootstrapData = getBootstrapData();
  const fullUser = bootstrapData?.user;
  const isAdmin = useMemo(() => isUserAdmin(fullUser), [fullUser]);

  const handleTaskAbort = useCallback(
    (task: Task) => {
      SupersetClient.post({
        endpoint: `/api/v1/task/${task.uuid}/abort`,
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

  const handleTaskUnsubscribe = useCallback(
    (task: Task) => {
      SupersetClient.post({
        endpoint: `/api/v1/task/${task.uuid}/unsubscribe`,
      }).then(
        () => {
          refreshData();
          addSuccessToast(
            t('Unsubscribed from task: %s', task.task_type || task.task_key),
          );
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue unsubscribing from the task: %s', errMsg),
          ),
        ),
      );
    },
    [addDangerToast, addSuccessToast, refreshData],
  );

  const handleBulkAbort = useCallback(
    (tasks: Task[]) => {
      // Filter tasks that can be aborted using the can_be_aborted field
      const abortableTasks = tasks.filter(task => task.can_be_aborted);

      if (abortableTasks.length === 0) {
        addDangerToast(
          t(
            'None of the selected tasks can be aborted (already completed or not abortable)',
          ),
        );
        return;
      }

      const taskUuids = abortableTasks.map(task => task.uuid);

      SupersetClient.post({
        endpoint: '/api/v1/task/bulk_abort',
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
            original: { task_name, task_key, uuid },
          },
        }: any) => {
          // Display preference: task_name > task_key
          const displayText = task_name || task_key;
          const truncated =
            displayText.length > 30
              ? `${displayText.slice(0, 30)}...`
              : displayText;

          // Build tooltip with all identifiers
          const tooltipLines = [];
          if (task_name) tooltipLines.push(`Name: ${task_name}`);
          tooltipLines.push(`Key: ${task_key}`);
          tooltipLines.push(`UUID: ${uuid}`);
          const tooltipText = tooltipLines.join('\n');

          return (
            <Tooltip
              title={
                <span style={{ whiteSpace: 'pre-line' }}>{tooltipText}</span>
              }
              placement="top"
            >
              <span>{truncated}</span>
            </Tooltip>
          );
        },
        accessor: 'task_name',
        Header: t('Task'),
        size: 'xl',
        id: 'task',
      },
      {
        Cell: ({
          row: {
            original: {
              status,
              progress_percent,
              progress_current,
              progress_total,
              duration_seconds,
              error_message,
              exception_type,
            },
          },
        }: any) => (
          <TaskStatusIcon
            status={status}
            progressPercent={progress_percent}
            progressCurrent={progress_current}
            progressTotal={progress_total}
            durationSeconds={duration_seconds}
            errorMessage={error_message}
            exceptionType={exception_type}
          />
        ),
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
            original: { scope },
          },
        }: any) => {
          const scopeConfig: Record<
            TaskScope,
            { label: string; type: 'default' | 'info' | 'warning' }
          > = {
            [TaskScope.Private]: { label: t('Private'), type: 'default' },
            [TaskScope.Shared]: { label: t('Shared'), type: 'info' },
            [TaskScope.System]: { label: t('System'), type: 'warning' },
          };

          const config = scopeConfig[scope as TaskScope] || {
            label: scope,
            type: 'default' as const,
          };

          return <Label type={config.type}>{config.label}</Label>;
        },
        accessor: 'scope',
        Header: t('Scope'),
        size: 'sm',
        id: 'scope',
      },
      {
        Cell: ({
          row: {
            original: { subscriber_count, subscribers },
          },
        }: any) => {
          if (!subscribers || subscriber_count === 0) {
            return '-';
          }

          // Convert subscribers to FacePile format
          const users = subscribers.map((sub: any) => ({
            id: sub.user_id,
            first_name: sub.first_name,
            last_name: sub.last_name,
          }));

          return <FacePile users={users} maxCount={3} />;
        },
        accessor: 'subscriber_count',
        Header: t('Subscribers'),
        size: 'md',
        id: 'subscribers',
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
        }: any) => <CreatedInfo date={createdOn} user={createdBy} />,
        Header: t('Created'),
        accessor: 'created_on',
        size: 'xl',
        id: 'created_on',
      },
      {
        // Hidden column for filtering by created_by
        accessor: 'created_by',
        id: 'created_by',
        hidden: true,
      },
      {
        Cell: ({
          row: {
            original: { duration_seconds },
          },
        }: any) => formatDuration(duration_seconds) ?? '-',
        accessor: 'duration_seconds',
        Header: t('Duration'),
        size: 'sm',
        id: 'duration_seconds',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { payload, stack_trace },
          },
        }: any) => {
          const hasPayload = payload && Object.keys(payload).length > 0;
          const hasStackTrace = !!stack_trace;

          if (!hasPayload && !hasStackTrace) {
            return null;
          }

          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              {hasPayload && <TaskPayloadPopover payload={payload} />}
              {hasStackTrace && (
                <TaskStackTracePopover stackTrace={stack_trace} />
              )}
            </div>
          );
        },
        accessor: 'payload',
        Header: t('Details'),
        size: 'xs',
        id: 'payload',
        disableSortBy: true,
      },
      {
        Cell: ({ row: { original } }: any) => {
          // Action button logic based on user role and task scope:
          //
          // For SHARED tasks:
          //   - Admins: Can abort any abortable task AND unsubscribe (if subscribed)
          //   - Non-admins: Can only unsubscribe (abort happens automatically if last subscriber)
          //
          // For PRIVATE/SYSTEM tasks:
          //   - Admins: Can abort any abortable task
          //   - Non-admins: Can abort their own private tasks (system tasks are admin-only)
          const isRunning = original.status === TaskStatus.InProgress;
          const isRunningButNotAbortable =
            isRunning && original.is_abortable === false;
          const taskIsAbortable =
            original.can_be_aborted && !original.is_aborting;

          const isSharedTask = original.scope === TaskScope.Shared;
          const userIsSubscribed = original.subscribers?.some(
            (sub: any) => sub.user_id === user.userId,
          );

          // Check if task is in a non-active state (completed or aborting)
          const isNonActiveStatus = [
            TaskStatus.Success,
            TaskStatus.Failure,
            TaskStatus.Aborted,
            TaskStatus.Aborting,
          ].includes(original.status);

          // Determine if abort button should be shown:
          // - Admins: Always show abort for abortable tasks (any scope)
          // - Non-admins on shared tasks: Never show abort (use unsubscribe instead)
          // - Non-admins on private tasks: Show abort if abortable (base filter ensures ownership)
          const showAbort = taskIsAbortable && (isAdmin || !isSharedTask);

          // Determine if unsubscribe button should be shown:
          // - Only for shared tasks where user is subscribed AND task is still active
          const showUnsubscribe =
            isSharedTask && userIsSubscribed && !isNonActiveStatus;

          // Show disabled button for running tasks without abort handler
          // (only if abort would otherwise be shown)
          const showDisabledAbort =
            isRunningButNotAbortable && (isAdmin || !isSharedTask);

          if (!showAbort && !showUnsubscribe && !showDisabledAbort) {
            return null;
          }

          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              {showDisabledAbort && (
                <Tooltip
                  id="abort-disabled-tooltip"
                  title={t('This task does not support aborting')}
                  placement="bottom"
                >
                  <span
                    className="action-button"
                    style={{ opacity: 0.4, cursor: 'not-allowed' }}
                  >
                    <Icons.StopOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
              {showAbort && (
                <ConfirmStatusChange
                  title={t('Please confirm')}
                  description={
                    <>
                      {t('Are you sure you want to abort')}{' '}
                      <b>{original.task_key}</b>?
                    </>
                  }
                  onConfirm={() => handleTaskAbort(original)}
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
              )}
              {showUnsubscribe && (
                <ConfirmStatusChange
                  title={t('Please confirm')}
                  description={
                    <>
                      {t('Are you sure you want to unsubscribe from')}{' '}
                      <b>{original.task_key}</b>?
                    </>
                  }
                  onConfirm={() => handleTaskUnsubscribe(original)}
                >
                  {confirmUnsubscribe => (
                    <Tooltip
                      id="unsubscribe-action-tooltip"
                      title={t('Unsubscribe')}
                      placement="bottom"
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        className="action-button"
                        onClick={confirmUnsubscribe}
                      >
                        <Icons.UserOutlined iconSize="l" />
                      </span>
                    </Tooltip>
                  )}
                </ConfirmStatusChange>
              )}
            </div>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        size: 'sm',
        disableSortBy: true,
      },
    ],
    [handleTaskAbort, handleTaskUnsubscribe, isAdmin, user.userId],
  );

  const filters: ListViewFilters = useMemo(
    () => [
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
          { label: t('Aborting'), value: TaskStatus.Aborting },
          { label: t('Aborted'), value: TaskStatus.Aborted },
        ],
      },
      {
        Header: t('Type'),
        key: 'task_type',
        id: 'task_type',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Scope'),
        key: 'scope',
        id: 'scope',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Private'), value: TaskScope.Private },
          { label: t('Shared'), value: TaskScope.Shared },
          { label: t('System'), value: TaskScope.System },
        ],
      },
      {
        Header: t('Created by'),
        key: 'created_by',
        id: 'created_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'task',
          'created_by',
          createErrorHandler(errMsg =>
            addDangerToast(
              t(
                'An error occurred while fetching created by values: %s',
                errMsg,
              ),
            ),
          ),
        ),
      },
    ],
    [addDangerToast],
  );

  const initialSort = [{ id: 'created_on', desc: true }];

  const emptyState = {
    title: t('No tasks yet'),
    image: 'filter-results.svg',
    description: t(
      'Tasks will appear here as background operations are executed.',
    ),
  };

  const bulkActions: ListViewProps['bulkActions'] = canWrite
    ? [
        {
          key: 'abort',
          name: t('Abort'),
          type: 'secondary',
          onSelect: (tasks: Task[]) => {
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
      <SubMenu name={t('Tasks')} buttons={subMenuButtons} />
      <ListView<Task>
        className="task-list-view"
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

export default withToasts(TaskList);
