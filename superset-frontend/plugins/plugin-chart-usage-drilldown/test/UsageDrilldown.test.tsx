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
import { fireEvent, render, screen } from '@superset-ui/core/spec';
import UsageDrilldown from '../src/UsageDrilldown';

const data = [
  { project: 'sprint 1', workflow: 'loop test', api: 'Get orders', calls: 14 },
  {
    project: 'sprint 1',
    workflow: '(not in a workflow)',
    api: 'Ping',
    calls: 3,
  },
  { project: 'empty project', workflow: '(no workflows)', api: null, calls: 0 },
];

function renderDrilldown() {
  return render(
    <UsageDrilldown
      height={400}
      width={800}
      data={data}
      levels={[
        { key: 'project', label: 'Project' },
        { key: 'workflow', label: 'Workflow' },
        { key: 'api', label: 'API' },
      ]}
      metricKey="calls"
      metricLabel="API calls"
      subtitleKeys={[]}
      hasDuration={false}
      titlePrefix="Usage by"
    />,
  );
}

test('workflow rows drill down to their APIs', () => {
  renderDrilldown();
  fireEvent.click(screen.getByText('sprint 1'));
  fireEvent.click(screen.getByText('loop test'));
  expect(screen.getByText('Get orders')).toBeInTheDocument();
});

test('calls without a workflow show "-" and cannot be opened', () => {
  renderDrilldown();
  fireEvent.click(screen.getByText('sprint 1'));
  expect(screen.queryByText('(not in a workflow)')).not.toBeInTheDocument();
  const row = screen.getByText('-').closest('tr')!;
  expect(row).not.toHaveClass('ud-clickable');
  fireEvent.click(row);
  expect(screen.queryByText('Ping')).not.toBeInTheDocument();
  expect(screen.getByText('Usage by workflow')).toBeInTheDocument();
});

test('hovering a row without a workflow explains why', async () => {
  renderDrilldown();
  fireEvent.click(screen.getByText('sprint 1'));
  fireEvent.mouseEnter(screen.getByText('-').closest('tr')!);
  expect(
    await screen.findByText(/older records that were saved without workflow/),
  ).toBeInTheDocument();
});

test('a project without workflows shows "-" with an explanation', async () => {
  renderDrilldown();
  fireEvent.click(screen.getByText('empty project'));
  expect(screen.queryByText('(no workflows)')).not.toBeInTheDocument();
  const row = screen.getByText('-').closest('tr')!;
  expect(row).not.toHaveClass('ud-clickable');
  fireEvent.mouseEnter(row);
  expect(
    await screen.findByText(
      'This project has no workflows, so there is nothing to show here.',
    ),
  ).toBeInTheDocument();
});
