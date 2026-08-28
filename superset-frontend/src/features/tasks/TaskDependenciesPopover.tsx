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

import { useState } from 'react';
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
  dependsOn: TaskDependency[];
  // Downstream tasks that depend on this task.
  requiredBy?: TaskDependency[];
  // Unmet prerequisites while this task is still pending (blocked). When > 0 the
  // icon turns warning-colored and the popover title reflects the wait.
  waitingOn?: number;
  // Fired when the popover opens/closes so the list can highlight the related
  // rows that are currently visible.
  onHoverChange?: (hovering: boolean) => void;
}

export default function TaskDependenciesPopover({
  dependsOn,
  requiredBy = [],
  waitingOn = 0,
  onHoverChange,
}: TaskDependenciesPopoverProps) {
  // Control the open state locally (like the other Task List popovers): the
  // parent list re-renders when hovering updates the row highlight, which would
  // reset an *uncontrolled* popover's open state and stop it from showing.
  const [open, setOpen] = useState(false);

  const content = (
    <DependenciesContainer>
      <DependencySection label={t('Depends on')} tasks={dependsOn} />
      <DependencySection label={t('Required by')} tasks={requiredBy} />
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
      open={open}
      onOpenChange={next => {
        setOpen(next);
        onHoverChange?.(next);
      }}
    >
      <DagIconWrapper $waiting={waitingOn > 0}>
        <Icons.PartitionOutlined iconSize="l" />
      </DagIconWrapper>
    </Popover>
  );
}
