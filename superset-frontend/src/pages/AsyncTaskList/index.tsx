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
import { SupersetClient, t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { useState, useMemo, useCallback } from 'react';
import { createErrorHandler } from 'src/views/CRUD/utils';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  ConfirmStatusChange,
  Tooltip,
  Loading,
} from '@superset-ui/core/components';
import {
  ModifiedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilters,
} from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Icons } from '@superset-ui/core/components/Icons';
import { AsyncTask, AsyncTaskListProps } from './types';

const PAGE_SIZE = 25;

const StyledActions = styled.div`
  color: ${({ theme }) => theme.colorIcon};
`;

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit}px;

  a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
  }

  svg {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const ProgressBar = styled.div<{ progress: number }>`
  width: 100%;
  height: 8px;
  background-color: ${({ theme }) => theme.colorBgContainerDisabled};
  border-radius: 4px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${props => props.progress}%;
    height: 100%;
    background-color: ${({ theme }) => theme.colorPrimary};
    transition: width 0.3s ease;
  }
`;

const ProgressContainer = styled.div`
  width: 80px;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const StatusBadge = styled.span<{ status: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;

  ${({ status, theme }) => {
    switch (status) {
      case 'pending':
        return `
          background-color: ${theme.colorWarningBg || theme.colorBgLayout};
          color: ${theme.colorWarning};
        `;
      case 'running':
        return `
          background-color: ${theme.colorPrimaryBg};
          color: ${theme.colorInfo};
        `;
      case 'completed':
        return `
          background-color: ${theme.colorSuccessBg || theme.colorBgLayout};
          color: ${theme.colorSuccess};
        `;
      case 'failed':
        return `
          background-color: ${theme.colorErrorBg || theme.colorBgLayout};
          color: ${theme.colorError};
        `;
      case 'cancelled':
        return `
          background-color: ${theme.colorBgContainerDisabled};
          color: ${theme.colorTextDisabled};
        `;
      default:
        return `
          background-color: ${theme.colorBgContainerDisabled};
          color: ${theme.colorTextDisabled};
        `;
    }
  }}
`;

const getStatusText = (status: string): string => {
  switch (status) {
    case 'pending':
      return t('Pending');
    case 'running':
      return t('Running');
    case 'completed':
      return t('Completed');
    case 'failed':
      return t('Failed');
    case 'cancelled':
      return t('Cancelled');
    default:
      return t('Unknown');
  }
};

function AsyncTaskList(props: AsyncTaskListProps) {
  const { addDangerToast, addSuccessToast } = props;

  const {
    state: {
      loading,
      resourceCount: taskCount,
      resourceCollection: tasks,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<AsyncTask>(
    'async_tasks',
    t('async task'),
    addDangerToast,
  );

  const [cancellingTasks, setCancellingTasks] = useState<Set<string>>(
    new Set(),
  );

  const handleTaskCancel = useCallback(
    (taskId: string) => {
      setCancellingTasks(prev => new Set([...prev, taskId]));

      SupersetClient.post({
        endpoint: `/api/v1/async_tasks/cancel`,
        body: JSON.stringify({ task_ids: [taskId] }),
        headers: { 'Content-Type': 'application/json' },
      })
        .then(
          ({ json = {} }) => {
            const success = json.result[taskId];
            if (success) {
              addSuccessToast(t('Task cancelled successfully'));
              refreshData();
            } else {
              addDangerToast(t('Failed to cancel task'));
            }
          },
          createErrorHandler(errMsg =>
            addDangerToast(
              t('There was an issue cancelling the task: %s', errMsg),
            ),
          ),
        )
        .finally(() => {
          setCancellingTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        });
    },
    [addDangerToast, addSuccessToast, refreshData],
  );

  const handleBulkTaskCancel = useCallback(
    (tasksToCancel: AsyncTask[]) => {
      const taskIds = tasksToCancel.map(task => task.id);

      SupersetClient.post({
        endpoint: `/api/v1/async_tasks/cancel`,
        body: JSON.stringify({ task_ids: taskIds }),
        headers: { 'Content-Type': 'application/json' },
      }).then(
        ({ json = {} }) => {
          const results = json.result;
          const successCount = Object.values(results).filter(Boolean).length;

          if (successCount > 0) {
            addSuccessToast(t('%d tasks cancelled successfully', successCount));
          }

          const failureCount = taskIds.length - successCount;
          if (failureCount > 0) {
            addDangerToast(t('Failed to cancel %d tasks', failureCount));
          }

          refreshData();
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue cancelling the tasks: %s', errMsg),
          ),
        ),
      );
    },
    [addDangerToast, addSuccessToast, refreshData],
  );

  const canCancel = hasPerm('can_write');
  const initialSort = [{ id: 'created_at', desc: true }];

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { id, task_name: taskName },
          },
        }: any) => (
          <FlexRowContainer>
            <Tooltip title={id} placement="top">
              <span>{taskName || t('Unnamed Task')}</span>
            </Tooltip>
          </FlexRowContainer>
        ),
        Header: t('Task'),
        accessor: 'task_name',
        id: 'task_name',
        size: 'lg',
      },
      {
        Cell: ({
          row: {
            original: { status },
          },
        }: any) => (
          <StatusBadge status={status}>{getStatusText(status)}</StatusBadge>
        ),
        Header: t('Status'),
        accessor: 'status',
        id: 'status',
        size: 'sm',
      },
      {
        Cell: ({
          row: {
            original: { progress },
          },
        }: any) => {
          if (progress === null || progress === undefined) {
            return <span>—</span>;
          }

          const percentage = Math.round(progress * 100);

          return (
            <ProgressContainer>
              <ProgressBar progress={percentage} />
              <span style={{ fontSize: '12px', minWidth: '30px' }}>
                {percentage}%
              </span>
            </ProgressContainer>
          );
        },
        Header: t('Progress'),
        accessor: 'progress',
        id: 'progress',
        size: 'md',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { created_at: createdAt },
          },
        }: any) => <ModifiedInfo date={createdAt} />,
        Header: t('Created'),
        accessor: 'created_at',
        id: 'created_at',
        size: 'lg',
      },
      {
        Cell: ({
          row: {
            original: { completed_at: completedAt, started_at: startedAt },
          },
        }: any) => {
          const displayDate = completedAt || startedAt;
          return displayDate ? (
            <ModifiedInfo date={displayDate} />
          ) : (
            <span>—</span>
          );
        },
        Header: t('Last Updated'),
        accessor: 'updated_at',
        id: 'updated_at',
        size: 'lg',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const { id, status } = original;
          const canCancelTask =
            canCancel && (status === 'pending' || status === 'running');
          const isCancelling = cancellingTasks.has(id);

          if (!canCancelTask) {
            return null;
          }

          const handleCancel = () => handleTaskCancel(id);

          return (
            <StyledActions className="actions">
              <ConfirmStatusChange
                title={t('Please confirm')}
                description={
                  <>{t('Are you sure you want to cancel this task?')}</>
                }
                onConfirm={handleCancel}
              >
                {confirmCancel => (
                  <Tooltip
                    id="cancel-action-tooltip"
                    title={t('Cancel')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={confirmCancel}
                      style={{ opacity: isCancelling ? 0.5 : 1 }}
                    >
                      {isCancelling ? (
                        <Loading position="inline" />
                      ) : (
                        <Icons.CloseOutlined iconSize="l" />
                      )}
                    </span>
                  </Tooltip>
                )}
              </ConfirmStatusChange>
            </StyledActions>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        size: 'sm',
        disableSortBy: true,
        hidden: !canCancel,
      },
    ],
    [canCancel, cancellingTasks, handleTaskCancel],
  );

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Task Name'),
        key: 'search',
        id: 'task_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Status'),
        key: 'status',
        id: 'status',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        selects: [
          { label: t('Pending'), value: 'pending' },
          { label: t('Running'), value: 'running' },
          { label: t('Completed'), value: 'completed' },
          { label: t('Failed'), value: 'failed' },
          { label: t('Cancelled'), value: 'cancelled' },
        ],
      },
    ],
    [],
  );

  const sortTypes = [
    {
      desc: true,
      id: 'created_at',
      label: t('Recently created'),
      value: 'recently_created',
    },
    {
      desc: false,
      id: 'created_at',
      label: t('Oldest first'),
      value: 'oldest_first',
    },
    {
      desc: true,
      id: 'updated_at',
      label: t('Recently updated'),
      value: 'recently_updated',
    },
  ];

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCancel) {
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      'data-test': 'bulk-select',
      onClick: toggleBulkSelect,
    });
  }

  return (
    <>
      <SubMenu name={t('Async Tasks')} buttons={subMenuButtons} />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to cancel the selected tasks?')}
        onConfirm={handleBulkTaskCancel}
      >
        {confirmCancel => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canCancel) {
            bulkActions.push({
              key: 'cancel',
              name: t('Cancel'),
              type: 'danger',
              onSelect: confirmCancel,
            });
          }

          return (
            <ListView<AsyncTask>
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              cardSortSelectOptions={sortTypes}
              className="async-task-list-view"
              columns={columns}
              count={taskCount}
              data={tasks}
              disableBulkSelect={toggleBulkSelect}
              refreshData={refreshData}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              defaultViewMode="table"
              addSuccessToast={addSuccessToast}
              addDangerToast={addDangerToast}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AsyncTaskList);
