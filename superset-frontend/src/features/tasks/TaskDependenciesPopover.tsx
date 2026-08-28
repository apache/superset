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

import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import TaskStatusIcon from './TaskStatusIcon';
import { TaskDependency } from './types';

const DependenciesContainer = styled.div`
  max-width: ${({ theme }) => theme.sizeUnit * 100}px;
  max-height: ${({ theme }) => theme.sizeUnit * 75}px;
  overflow: auto;
  padding: ${({ theme }) => theme.sizeUnit}px 0;
`;

const SectionLabel = styled.div`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme }) => theme.colorTextSecondary};
  padding: ${({ theme }) => theme.sizeUnit / 2}px
    ${({ theme }) => theme.sizeUnit * 2}px;
`;

const DependencyRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  padding: ${({ theme }) => theme.sizeUnit / 2}px
    ${({ theme }) => theme.sizeUnit * 2}px;
`;

const DependencyName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DagIconWrapper = styled.span<{ $waiting?: boolean }>`
  cursor: pointer;
  color: ${({ theme, $waiting }) =>
    $waiting ? theme.colorWarningText : theme.colorIcon};

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
  }
`;

function DependencySection({
  label,
  tasks,
}: {
  label: string;
  tasks: TaskDependency[];
}) {
  if (!tasks.length) {
    return null;
  }
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      {tasks.map(task => (
        <DependencyRow key={task.uuid}>
          <TaskStatusIcon status={task.status} />
          <DependencyName>{task.task_name || task.uuid}</DependencyName>
        </DependencyRow>
      ))}
    </>
  );
}

interface TaskDependenciesPopoverProps {
  // Upstream prerequisites this task depends on.
  dependencies: TaskDependency[];
  // Downstream tasks that depend on this task.
  dependents?: TaskDependency[];
  // Unmet prerequisites while this task is still pending (blocked). When > 0 the
  // icon turns warning-colored and the popover title reflects the wait.
  waitingOn?: number;
  // Fired on hover enter/leave of the icon so the list can highlight the related
  // rows that are currently visible. Driven from mouse events rather than the
  // Popover's onOpenChange: setting state inside antd's own open callback can
  // wedge the hover popover.
  onHoverChange?: (hovering: boolean) => void;
}

export default function TaskDependenciesPopover({
  dependencies,
  dependents = [],
  waitingOn = 0,
  onHoverChange,
}: TaskDependenciesPopoverProps) {
  const content = (
    <DependenciesContainer>
      <DependencySection label={t('Depends on')} tasks={dependencies} />
      <DependencySection label={t('Required by')} tasks={dependents} />
    </DependenciesContainer>
  );

  return (
    <Popover
      title={
        waitingOn > 0
          ? t('Waiting on %s prerequisite task(s) to finish', waitingOn)
          : t('Dependencies')
      }
      content={content}
      trigger="hover"
      placement="leftTop"
    >
      <DagIconWrapper
        $waiting={waitingOn > 0}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
      >
        <Icons.PartitionOutlined iconSize="l" />
      </DagIconWrapper>
    </Popover>
  );
}
