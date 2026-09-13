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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { TaskStatus } from './types';
import TaskDependenciesPopover from './TaskDependenciesPopover';

const dependencies = [
  { uuid: 'prereq-1', task_name: 'Totals Query', status: TaskStatus.Success },
  { uuid: 'prereq-2', task_name: null, status: TaskStatus.InProgress },
];

const dependents = [
  {
    uuid: 'dep-1',
    task_name: 'Contribution Query',
    status: TaskStatus.Pending,
  },
];

test('renders the branching trigger icon', () => {
  render(<TaskDependenciesPopover dependsOn={dependencies} />, {
    useRedux: true,
  });
  expect(screen.getByRole('img', { name: 'partition' })).toBeInTheDocument();
});

test('lists upstream and downstream tasks in the popover on hover', async () => {
  render(
    <TaskDependenciesPopover
      dependsOn={dependencies}
      requiredBy={dependents}
    />,
    { useRedux: true },
  );

  fireEvent.mouseEnter(screen.getByRole('img', { name: 'partition' }));

  // Upstream section: named prerequisite shows its name, the unnamed one its uuid
  expect(await screen.findByText('Totals Query')).toBeInTheDocument();
  expect(screen.getByText('prereq-2')).toBeInTheDocument();
  expect(screen.getByText('Depends on')).toBeInTheDocument();
  // Downstream section
  expect(screen.getByText('Contribution Query')).toBeInTheDocument();
  expect(screen.getByText('Required by')).toBeInTheDocument();
});

test('surfaces the waiting-on state in the popover title', async () => {
  render(<TaskDependenciesPopover dependsOn={dependencies} waitingOn={1} />, {
    useRedux: true,
  });

  fireEvent.mouseEnter(screen.getByRole('img', { name: 'partition' }));

  expect(
    await screen.findByText('Waiting on 1 prerequisite task(s) to finish'),
  ).toBeInTheDocument();
});

test('uses the neutral "Dependencies" title when not waiting', async () => {
  render(<TaskDependenciesPopover dependsOn={dependencies} />, {
    useRedux: true,
  });

  fireEvent.mouseEnter(screen.getByRole('img', { name: 'partition' }));

  expect(await screen.findByText('Dependencies')).toBeInTheDocument();
});
