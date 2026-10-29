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

import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { useTheme, css } from '@apache-superset/core/theme';
import { t, tn } from '@apache-superset/core/translation';
import { useMemo, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  ActionButton,
  Tooltip,
  Label,
  Modal,
  Checkbox,
  Flex,
} from '@superset-ui/core/components';
import {
  CreatedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewFilters,
} from 'src/components';
import { SubjectPile } from 'src/features/subjects/SubjectPile';
import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  createErrorHandler,
  createFetchDistinct,
  createFetchRelated,
} from 'src/views/CRUD/utils';
import TaskStatusIcon from 'src/features/tasks/TaskStatusIcon';
import TaskPayloadPopover from 'src/features/tasks/TaskPayloadPopover';
import TaskStackTracePopover from 'src/features/tasks/TaskStackTracePopover';
import TaskDependenciesPopover from 'src/features/tasks/TaskDependenciesPopover';
import LiveDuration from 'src/features/tasks/LiveDuration';
import {
  Task,
  TaskStatus,
  TaskScope,
  canAbortTask,
  isTaskAborting,
  TaskSubscriber,
} from 'src/features/tasks/types';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import getBootstrapData from 'src/utils/getBootstrapData';
import type { RootState } from 'src/views/store';

const PAGE_SIZE = 25;

/**
 * Typed cell props for react-table columns.
 * Replaces `: any` for better type safety in Cell render functions.
 */
interface TaskCellProps {
  row: {
    original: Task;
  };
}

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
  const theme = useTheme();
  const locale = useSelector((state: RootState) => state.common?.locale);

  // Check if GTF feature flag is enabled
  if (!isFeatureEnabled(FeatureFlag.GlobalTaskFramework)) {
    return (
      <>
        <SubMenu name={t('Tasks')} />
        <Flex
          vertical
          align="center"
          justify="center"
          css={css`
            height: 50vh;
            color: ${theme.colorTextSecondary};
          `}
        >
          <h3>{t('Feature Not Enabled')}</h3>
          <p>
            {t(
              'The Global Task Framework is not enabled. Please contact your administrator to enable the GLOBAL_TASK_FRAMEWORK feature flag.',
            )}
          </p>
        </Flex>
      </>
    );
  }

  const {
    state: { loading, resourceCount: tasksCount, resourceCollection: tasks },
    fetchData,
    refreshData,
  } = useListViewResource<Task>(
    'task',
    t('task'),
    addDangerToast,
    true, // infoEnable
    [], // defaultCollectionValue
    undefined, // baseFilters
    true, // initialLoadingState
    undefined, // selectColumns
    true, // enableRealtime
  );

  // Get full user with roles to check admin status
  const bootstrapData = getBootstrapData();
  const fullUser = bootstrapData?.user;
  const isAdmin = useMemo(() => isUserAdmin(fullUser), [fullUser]);
  // Realtime push is active only when the websocket transport is enabled (this
  // flag is already permission-masked server-side). Used to tick a running
  // task's duration live; otherwise the duration refreshes on each poll.
  const realtimeEnabled = Boolean(
    bootstrapData?.common?.conf?.WEBSOCKET_ENABLE,
  );

  // State for cancel confirmation modal
  const [cancelModalTask, setCancelModalTask] = useState<Task | null>(null);
  const [forceCancel, setForceCancel] = useState(false);

  // UUIDs of the prerequisite tasks to highlight while a "Depends on" popover is
  // open, so the user can spot which visible rows this task waits on.
  const [highlightedDeps, setHighlightedDeps] = useState<Set<string>>(
    () => new Set(),
  );

  // Determine dialog message based on task context
  const getCancelDialogMessage = useCallback((task: Task) => {
    const isSharedTask = task.scope === TaskScope.Shared;
    const subscriberCount = task.subscriber_count || 0;
    const otherSubscribers = subscriberCount - 1;

    // If it's going to abort (private, system, or last subscriber)
    if (!isSharedTask || subscriberCount <= 1) {
      return t('This will cancel the task.');
    }

    // Shared task with multiple subscribers
    return t(
      "You'll be removed from this task. It will continue running for %s other subscriber(s).",
      otherSubscribers,
    );
  }, []);

  // Get force abort message for admin checkbox
  const getForceAbortMessage = useCallback((task: Task) => {
    const subscriberCount = task.subscriber_count || 0;
    return t(
      'This will abort (stop) the task for all %s subscriber(s).',
      subscriberCount,
    );
  }, []);

  // Check if current user is subscribed to a task
  const isUserSubscribed = useCallback(
    (task: Task) =>
      task.subscribers?.some(
        (sub: TaskSubscriber) => sub.user_id === user.userId,
      ) ?? false,
    [user.userId],
  );

  // Check if force cancel option should be shown (for admins on shared tasks)
  const showForceCancelOption = useCallback(
    (task: Task) => {
      const isSharedTask = task.scope === TaskScope.Shared;
      const subscriberCount = task.subscriber_count || 0;
      const userSubscribed = isUserSubscribed(task);
      // Show for admins on shared tasks when:
      // - Not subscribed (can only abort, so show checkbox pre-checked disabled), OR
      // - Multiple subscribers (can choose between unsubscribe and force abort)
      // Don't show when admin is the sole subscriber - cancel will abort anyway
      return (
        isAdmin && isSharedTask && (subscriberCount > 1 || !userSubscribed)
      );
    },
    [isAdmin, isUserSubscribed],
  );

  // Check if force cancel checkbox should be disabled (admin not subscribed)
  const isForceCancelDisabled = useCallback(
    (task: Task) => isAdmin && !isUserSubscribed(task),
    [isAdmin, isUserSubscribed],
  );

  const handleTaskCancel = useCallback(
    (task: Task, force: boolean = false) => {
      SupersetClient.post({
        endpoint: `/api/v1/task/${task.uuid}/cancel`,
        jsonPayload: force ? { force: true } : {},
      }).then(
        ({ json }) => {
          refreshData();
          const { action } = json as { action: string };
          if (action === 'aborted') {
            addSuccessToast(
              t('Task cancelled: %s', task.task_name || task.task_key),
            );
          } else {
            addSuccessToast(
              t(
                'You have been removed from task: %s',
                task.task_name || task.task_key,
              ),
            );
          }
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue cancelling the task: %s', errMsg),
          ),
        ),
      );
    },
    [addDangerToast, addSuccessToast, refreshData],
  );

  // Handle opening the cancel modal - set initial forceCancel state
  const openCancelModal = useCallback(
    (task: Task) => {
      // Pre-check force cancel if admin is not subscribed
      const shouldPreCheck = isAdmin && !isUserSubscribed(task);
      setForceCancel(shouldPreCheck);
      setCancelModalTask(task);
    },
    [isAdmin, isUserSubscribed],
  );

  // Handle modal confirmation
  const handleCancelConfirm = useCallback(() => {
    if (cancelModalTask) {
      handleTaskCancel(cancelModalTask, forceCancel);
      setCancelModalTask(null);
      setForceCancel(false);
    }
  }, [cancelModalTask, forceCancel, handleTaskCancel]);

  // Handle modal close
  const handleCancelModalClose = useCallback(() => {
    setCancelModalTask(null);
    setForceCancel(false);
  }, []);

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { task_name, task_key, uuid },
          },
        }: TaskCellProps) => {
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
        id: 'task_name',
      },
      {
        Cell: ({
          row: {
            original: { status, properties, duration_seconds },
          },
        }: TaskCellProps) => (
          <TaskStatusIcon
            status={status as TaskStatus}
            progressPercent={properties?.progress_percent}
            progressCurrent={properties?.progress_current}
            progressTotal={properties?.progress_total}
            durationSeconds={duration_seconds}
            errorMessage={properties?.error_message}
            exceptionType={properties?.private?.framework?.exception_type}
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
        }: TaskCellProps) => {
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
        }: TaskCellProps) => {
          if (!subscribers || subscriber_count === 0) {
            return '-';
          }

          // Convert subscribers to SubjectPile format. Authenticated users show
          // their name initials; embedded guests (no profile) show their
          // anonymized G1/G2 label under a synthetic negative id (there is no
          // user_id to key on, and negatives can't collide with real user ids).
          const subjects = subscribers.map(
            (sub: TaskSubscriber, index: number) =>
              sub.is_guest
                ? {
                    id: -(index + 1),
                    label: sub.label ?? t('Guest'),
                    type: 1,
                  }
                : {
                    id: sub.user_id as number,
                    label:
                      `${sub.first_name ?? ''} ${sub.last_name ?? ''}`.trim(),
                    type: 1,
                  },
          );

          return <SubjectPile subjects={subjects} maxCount={3} />;
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
        }: TaskCellProps) => (
          <CreatedInfo date={createdOn ?? ''} user={createdBy ?? undefined} />
        ),
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
            original: { duration_seconds, status },
          },
        }: TaskCellProps) => (
          <LiveDuration
            durationSeconds={duration_seconds}
            locale={locale}
            live={
              realtimeEnabled &&
              (status === TaskStatus.InProgress ||
                status === TaskStatus.Aborting)
            }
          />
        ),
        accessor: 'duration_seconds',
        Header: t('Duration'),
        size: 'sm',
        id: 'duration_seconds',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { payload, properties, status, depends_on, required_by },
          },
        }: TaskCellProps) => {
          const hasPayload = payload && Object.keys(payload).length > 0;
          // Internal (debug-only) state; the API includes `private` only in debug
          // mode, and seeds empty framework/task namespaces, so check for content.
          const taskPrivate = properties?.private;
          const hasPrivate =
            !!taskPrivate &&
            (Object.keys(taskPrivate.framework ?? {}).length > 0 ||
              Object.keys(taskPrivate.task ?? {}).length > 0);
          const hasStackTrace = !!taskPrivate?.framework?.stack_trace;
          const hasDependsOn = !!depends_on && depends_on.length > 0;
          const hasRequiredBy = !!required_by && required_by.length > 0;
          const dedupeCount = properties?.dedupe_count ?? 0;

          // Show warning if timeout is set but no abort handler during execution
          // Only show for IN_PROGRESS (abort handler registers at runtime, not during PENDING)
          const hasTimeoutWithoutHandler =
            status === TaskStatus.InProgress &&
            properties?.timeout &&
            !properties?.is_abortable;

          if (
            !hasPayload &&
            !hasPrivate &&
            !hasStackTrace &&
            !hasTimeoutWithoutHandler &&
            !hasDependsOn &&
            !hasRequiredBy &&
            !dedupeCount
          ) {
            return null;
          }

          // "Waiting on N" surfaces the block-and-wait gate: a PENDING task
          // parked until its unmet (non-SUCCESS) prerequisites finish. Folded
          // into the dependency icon (warning color + popover title).
          const unmet = hasDependsOn
            ? depends_on.filter(dep => dep.status !== TaskStatus.Success).length
            : 0;
          const waitingOn =
            status === TaskStatus.Pending && unmet > 0 ? unmet : 0;

          return (
            <Flex gap={theme.sizeUnit * 2}>
              {hasTimeoutWithoutHandler && (
                <Tooltip
                  title={t(
                    'Timeout configured (%s seconds) but no abort handler defined. ' +
                      'Task will continue running past the timeout.',
                    properties.timeout,
                  )}
                  placement="top"
                >
                  <span>
                    <Icons.WarningOutlined
                      iconSize="l"
                      iconColor={theme.colorWarningText}
                    />
                  </span>
                </Tooltip>
              )}
              {(hasPayload || hasPrivate) && (
                <TaskPayloadPopover
                  payload={payload}
                  taskPrivate={taskPrivate}
                />
              )}
              {hasStackTrace && taskPrivate?.framework?.stack_trace && (
                <TaskStackTracePopover
                  stackTrace={taskPrivate.framework.stack_trace}
                />
              )}
              {(hasDependsOn || hasRequiredBy) && (
                <TaskDependenciesPopover
                  dependsOn={depends_on ?? []}
                  requiredBy={required_by ?? []}
                  waitingOn={waitingOn}
                  onHoverChange={hovering =>
                    setHighlightedDeps(
                      hovering
                        ? new Set(
                            [...(depends_on ?? []), ...(required_by ?? [])].map(
                              dep => dep.uuid,
                            ),
                          )
                        : new Set(),
                    )
                  }
                />
              )}
              {dedupeCount > 0 && (
                <Tooltip
                  title={tn(
                    'Reused by 1 other submission',
                    'Reused by %s other submissions',
                    dedupeCount,
                    dedupeCount,
                  )}
                  placement="top"
                >
                  {/* Wrap in a span: Tooltip needs a ref-able DOM node, and the
                      Flex wrapper is a function component that does not forward
                      refs (mirrors the warning Tooltip above). */}
                  <span>
                    <Flex component="span" align="center" gap={theme.sizeUnit}>
                      <Icons.PlusOutlined iconSize="l" />
                      {dedupeCount}
                    </Flex>
                  </span>
                </Tooltip>
              )}
            </Flex>
          );
        },
        accessor: 'payload',
        Header: t('Details'),
        size: 'sm',
        id: 'payload',
        disableSortBy: true,
      },
      {
        Cell: ({ row: { original } }: TaskCellProps) => {
          // Unified Cancel button logic:
          // - Show Cancel for any active task that the user can cancel
          // - The backend handles the smart behavior (unsubscribe vs abort)
          const isRunning = original.status === TaskStatus.InProgress;
          // Task is not cancellable if running without abort handler
          // Use !== true to catch false, undefined, and null
          const isRunningButNotCancellable =
            isRunning && !original.properties?.is_abortable;

          const isSharedTask = original.scope === TaskScope.Shared;
          const userIsSubscribed = original.subscribers?.some(
            (sub: TaskSubscriber) => sub.user_id === user.userId,
          );

          // Check if task is in a non-active state (completed or aborting)
          const isNonActiveStatus = [
            TaskStatus.Success,
            TaskStatus.Failure,
            TaskStatus.Aborted,
            TaskStatus.Aborting,
            TaskStatus.TimedOut,
          ].includes(original.status as TaskStatus);

          // Show disabled button for running tasks without abort handler
          // (only for non-shared tasks or when user is the only subscriber)
          const showDisabledCancel =
            isRunningButNotCancellable &&
            !isNonActiveStatus &&
            (!isSharedTask || (original.subscriber_count || 0) <= 1);

          // Show Cancel button when:
          // 1. Task can be aborted (pending, or in-progress with handler), OR
          // 2. User is subscribed to a shared task (can always unsubscribe)
          // But NOT when disabled cancel is shown (mutually exclusive)
          const canCancelTask =
            !showDisabledCancel &&
            ((canAbortTask(original) && !isTaskAborting(original)) ||
              (isSharedTask && userIsSubscribed && !isNonActiveStatus));

          if (!canCancelTask && !showDisabledCancel) {
            return null;
          }

          return (
            <Flex gap={theme.sizeUnit * 2}>
              {showDisabledCancel && (
                <Tooltip
                  id="cancel-disabled-tooltip"
                  title={t(
                    'Cancellation not available due to missing abort handler',
                  )}
                  placement="bottom"
                >
                  <span
                    className="action-button"
                    style={{ cursor: 'not-allowed' }}
                  >
                    <Icons.StopOutlined
                      iconSize="l"
                      iconColor={theme.colorTextDisabled}
                    />
                  </span>
                </Tooltip>
              )}
              {canCancelTask && (
                <ActionButton
                  label={t('Cancel')}
                  tooltip={t('Cancel')}
                  placement="bottom"
                  icon={<Icons.StopOutlined iconSize="l" />}
                  onClick={() => openCancelModal(original)}
                />
              )}
            </Flex>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        size: 'sm',
        disableSortBy: true,
      },
    ],
    [user.userId, theme, locale, openCancelModal, realtimeEnabled],
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
          { label: t('Timed Out'), value: TaskStatus.TimedOut },
          { label: t('Aborting'), value: TaskStatus.Aborting },
          { label: t('Aborted'), value: TaskStatus.Aborted },
        ],
      },
      {
        Header: t('Type'),
        key: 'task_type',
        id: 'task_type',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('Any'),
        fetchSelects: createFetchDistinct(
          'task',
          'task_type',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching task types: %s', errMsg),
            ),
          ),
        ),
      },
      {
        Header: t('Name'),
        key: 'task_name',
        id: 'task_name',
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

  return (
    <>
      <SubMenu name={t('Tasks')} />
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
        isRowHighlighted={record => highlightedDeps.has(record.uuid as string)}
        pageSize={PAGE_SIZE}
        refreshData={refreshData}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />

      {/* Cancel Confirmation Modal */}
      <Modal
        title={t('Cancel Task')}
        show={!!cancelModalTask}
        onHide={handleCancelModalClose}
        primaryButtonName={t('Yes, Cancel')}
        onHandledPrimaryAction={handleCancelConfirm}
      >
        {cancelModalTask && (
          <>
            <p>
              {forceCancel
                ? getForceAbortMessage(cancelModalTask)
                : getCancelDialogMessage(cancelModalTask)}
            </p>
            {showForceCancelOption(cancelModalTask) && (
              <Checkbox
                checked={forceCancel}
                onChange={e => setForceCancel(e.target.checked)}
                disabled={isForceCancelDisabled(cancelModalTask)}
              >
                {t('Force abort (stops task for all subscribers)')}
              </Checkbox>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

export default withToasts(TaskList);
