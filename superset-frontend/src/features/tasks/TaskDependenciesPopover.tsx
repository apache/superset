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

const LinkIconWrapper = styled.span<{ $waiting?: boolean }>`
  cursor: pointer;
  color: ${({ theme, $waiting }) =>
    $waiting ? theme.colorWarningText : theme.colorIcon};

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
  }
`;

interface TaskDependenciesPopoverProps {
  dependencies: TaskDependency[];
  // Unmet prerequisites while this task is still pending (blocked). When > 0 the
  // chain icon turns warning-colored and the popover title reflects the wait.
  waitingOn?: number;
}

export default function TaskDependenciesPopover({
  dependencies,
  waitingOn = 0,
}: TaskDependenciesPopoverProps) {
  const content = (
    <DependenciesContainer>
      {dependencies.map(dependency => (
        <DependencyRow key={dependency.uuid}>
          <TaskStatusIcon status={dependency.status} />
          <DependencyName>
            {dependency.task_name || dependency.uuid}
          </DependencyName>
        </DependencyRow>
      ))}
    </DependenciesContainer>
  );

  return (
    <Popover
      title={
        waitingOn > 0
          ? t('Waiting on %s prerequisite task(s) to finish', waitingOn)
          : t('Depends on')
      }
      content={content}
      trigger="hover"
      placement="leftTop"
    >
      <LinkIconWrapper $waiting={waitingOn > 0}>
        <Icons.LinkOutlined iconSize="l" />
      </LinkIconWrapper>
    </Popover>
  );
}
