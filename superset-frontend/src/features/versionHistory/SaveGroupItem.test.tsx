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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import type { SaveGroup } from './types';
import SaveGroupItem from './SaveGroupItem';

const creationGroup = (overrides: Partial<SaveGroup> = {}): SaveGroup => ({
  type: 'group',
  transactionId: 5,
  versionUuid: 'v-created',
  issuedAt: '2025-12-05T17:18:00',
  changedBy: { id: 1, first_name: 'Ada', last_name: 'Lovelace' },
  actionKind: null,
  records: [],
  creationKind: 'created',
  ...overrides,
});

const renderItem = (
  group: SaveGroup,
  {
    entityType = 'chart',
    isCurrent = false,
    onPreview = jest.fn(),
  }: {
    entityType?: 'chart' | 'dashboard';
    isCurrent?: boolean;
    onPreview?: jest.Mock;
  } = {},
) => {
  render(
    <SaveGroupItem
      entityType={entityType}
      group={group}
      isCurrent={isCurrent}
      canRestore
      isPreviewed={false}
      onPreview={onPreview}
      onRestore={jest.fn()}
      onOpenAsNew={jest.fn()}
    />,
  );
  return { onPreview };
};

test('a chart starting group exposes an explicit preview action', async () => {
  const onPreview = jest.fn();
  const group = creationGroup();
  renderItem(group, { onPreview });

  const button = screen.getByRole('button', { name: 'Preview this version' });
  await userEvent.click(button);

  expect(onPreview).toHaveBeenCalledWith(group);
});

test('a dashboard starting group exposes the same preview action via keyboard', async () => {
  const onPreview = jest.fn();
  const group = creationGroup({ creationKind: 'pre_tracking' });
  renderItem(group, { entityType: 'dashboard', onPreview });

  const button = screen.getByRole('button', { name: 'Preview this version' });
  button.focus();
  await userEvent.type(button, '{enter}', { skipClick: true });

  expect(onPreview).toHaveBeenCalledWith(group);
});

test('the current starting version has nothing to preview', () => {
  renderItem(creationGroup(), { isCurrent: true });

  expect(
    screen.queryByRole('button', { name: 'Preview this version' }),
  ).not.toBeInTheDocument();
});

test('ordinary record-bearing groups do not grow the creation affordance', () => {
  renderItem(
    creationGroup({
      creationKind: undefined,
      records: [
        {
          version_uuid: 'v-1',
          entity_kind: 'chart',
          entity_uuid: 'e-1',
          entity_name: 'My chart',
          entity_deleted: false,
          entity_deletion_state: null,
          source: 'self',
          transaction_id: 5,
          action_kind: null,
          issued_at: '2025-12-05T17:18:00',
          changed_by: null,
          kind: 'metric',
          operation: 'add',
          path: ['params'],
          from_value: null,
          to_value: null,
          summary: '',
          impact: null,
        },
      ],
    }),
  );

  expect(
    screen.queryByRole('button', { name: 'Preview this version' }),
  ).not.toBeInTheDocument();
});
