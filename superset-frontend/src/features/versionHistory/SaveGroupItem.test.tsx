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
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from 'spec/helpers/testing-library';
import type { ActivityRecord, SaveGroup, VersionedEntityType } from './types';
import SaveGroupItem, { SaveGroupItemProps } from './SaveGroupItem';
import ActionRow from './ActionRow';

test.each(['chart', 'field'])(
  '%s activity without a snapshot is inert and explains why',
  async kind => {
    const record: ActivityRecord = {
      version_uuid: null,
      entity_kind: 'dashboard',
      entity_uuid: 'entity-uuid',
      entity_name: 'Dashboard',
      entity_deleted: false,
      entity_deletion_state: null,
      source: 'self',
      transaction_id: 7,
      action_kind: null,
      issued_at: '2026-08-31T17:46:00',
      changed_by: null,
      kind,
      operation: 'add',
      path: [],
      from_value: null,
      to_value: null,
      summary: '',
      impact: null,
    };
    const onPreview = jest.fn();
    render(
      <ActionRow
        record={record}
        isHighlighted={false}
        isLast
        onPreview={onPreview}
      />,
    );
    const row = screen.getByTestId('version-history-action-row');
    expect(row).not.toHaveAttribute('role');
    expect(row).not.toHaveAttribute('tabindex');
    expect(row).toHaveStyle({ cursor: 'default' });
    expect(row).not.toHaveStyleRule('background-color', expect.any(String), {
      target: ':hover',
    });
    expect(screen.getByText('No saved version to preview')).toBeVisible();
    await userEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onPreview).not.toHaveBeenCalled();
  },
);

const makeGroup = (overrides: Partial<SaveGroup> = {}): SaveGroup => ({
  type: 'group',
  transactionId: 7,
  versionUuid: 'version-uuid',
  issuedAt: '2026-08-31T17:46:00',
  changedBy: null,
  actionKind: null,
  records: [],
  ...overrides,
});

const renderItem = (props: Partial<SaveGroupItemProps> = {}) =>
  render(
    <SaveGroupItem
      entityType="chart"
      group={makeGroup()}
      isCurrent={false}
      canRestore
      isHighlighted={false}
      marksCurrentState={false}
      onPreview={jest.fn()}
      onExitPreview={jest.fn()}
      onRestore={jest.fn()}
      onOpenAsNew={jest.fn()}
      {...props}
    />,
  );

const groupBackground = (root: HTMLElement) =>
  getComputedStyle(within(root).getByTestId('version-history-save-group'))
    .backgroundColor;

test.each<VersionedEntityType>(['chart', 'dashboard'])(
  '%s saves without snapshots omit the preview and version menu',
  entityType => {
    renderItem({
      entityType,
      group: makeGroup({ versionUuid: null, creationKind: 'created' }),
    });
    expect(screen.getByTestId('version-history-save-group')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /preview/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'More actions' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Restore this version')).not.toBeInTheDocument();
  },
);

test('a highlighted group carries the active treatment; a resting one does not', () => {
  // Which single group is highlighted is the panel's decision (see the
  // exclusivity test in VersionHistoryPanel.test.tsx); this component's
  // contract is only that the flag renders the active treatment.
  const { container: highlighted } = renderItem({ isHighlighted: true });
  const { container: resting } = renderItem();

  expect(groupBackground(highlighted)).not.toBe(groupBackground(resting));
});

test('every dated save uses the save icon and no Current tag, the live one included', () => {
  const { container: current } = renderItem({ isCurrent: true });
  const { container: historical } = renderItem();

  for (const container of [current, historical]) {
    expect(within(container).getByRole('img', { name: 'save' })).toBeVisible();
    expect(
      within(container).queryByRole('img', { name: 'check-circle' }),
    ).not.toBeInTheDocument();
    expect(within(container).queryByText('Current')).not.toBeInTheDocument();
  }
});

test('a latest save with no records has a text label without a focusable no-op header', () => {
  const { container } = renderItem({
    isCurrent: true,
    marksCurrentState: true,
  });

  expect(within(container).getByText('Latest save')).toBeVisible();
  expect(within(container).getAllByRole('button')).toEqual([
    within(container).getByRole('button', { name: 'More actions' }),
  ]);
  expect(container.querySelector('[aria-current]')).not.toBeInTheDocument();
});

test('rows of the highlighted group show the active timeline dot', () => {
  const record = {
    version_uuid: 'version-uuid',
    entity_kind: 'chart',
    entity_uuid: 'entity-uuid',
    entity_name: 'My chart',
    entity_deleted: false,
    entity_deletion_state: null,
    source: 'self',
    transaction_id: 7,
    action_kind: null,
    issued_at: '2026-08-31T17:46:00',
    changed_by: null,
    kind: 'metrics',
    operation: 'update',
    path: ['metrics'],
    from_value: null,
    to_value: null,
    summary: '',
    impact: null,
  } satisfies ActivityRecord;
  const { container: current } = renderItem({
    isCurrent: true,
    isHighlighted: true,
    group: makeGroup({ records: [record] }),
  });
  const { container: historical } = renderItem({
    group: makeGroup({ records: [record] }),
  });

  // The kebab's dropdown trigger also carries aria-expanded, so pick the
  // group header by its element kind: it is the one non-<button> button.
  const expandGroup = (root: HTMLElement) => {
    const header = within(root)
      .getAllByRole('button', { expanded: false })
      .find(el => el.tagName !== 'BUTTON') as HTMLElement;
    fireEvent.click(header);
  };
  const dotBorderColor = (root: HTMLElement) =>
    getComputedStyle(
      within(root)
        .getByTestId('version-history-action-row')
        .querySelector('span') as HTMLElement,
    ).borderColor;

  expandGroup(current);
  expandGroup(historical);
  expect(dotBorderColor(current)).not.toBe(dotBorderColor(historical));
});

const creationGroup = (overrides: Partial<SaveGroup> = {}): SaveGroup =>
  makeGroup({
    transactionId: 5,
    versionUuid: 'v-created',
    issuedAt: '2025-12-05T17:18:00',
    changedBy: { id: 1, first_name: 'Ada', last_name: 'Lovelace' },
    creationKind: 'created',
    ...overrides,
  });

test('a chart starting group exposes an explicit preview action', async () => {
  const onPreview = jest.fn();
  const group = creationGroup();
  renderItem({ group, onPreview });

  const button = screen.getByRole('button', { name: 'Preview this version' });
  await userEvent.click(button);

  expect(onPreview).toHaveBeenCalledWith(group);
});

test('a dashboard starting group exposes the same preview action via keyboard', async () => {
  const onPreview = jest.fn();
  const group = creationGroup({ creationKind: 'pre_tracking' });
  renderItem({ group, onPreview, entityType: 'dashboard' });

  const button = screen.getByRole('button', { name: 'Preview this version' });
  button.focus();
  await userEvent.type(button, '{enter}', { skipClick: true });

  expect(onPreview).toHaveBeenCalledWith(group);
});

test('the current starting version has nothing to preview', () => {
  renderItem({ group: creationGroup(), isCurrent: true });

  expect(
    screen.queryByRole('button', { name: 'Preview this version' }),
  ).not.toBeInTheDocument();
});

test.each([
  { entityType: 'chart', creationKind: undefined },
  { entityType: 'chart', creationKind: 'pre_tracking' },
  { entityType: 'chart', creationKind: 'created' },
  { entityType: 'dashboard', creationKind: undefined },
  { entityType: 'dashboard', creationKind: 'pre_tracking' },
  { entityType: 'dashboard', creationKind: 'created' },
] satisfies {
  entityType: VersionedEntityType;
  creationKind: SaveGroup['creationKind'];
}[])(
  '$entityType historical save ($creationKind) previews from its collapsed header',
  async ({ entityType, creationKind }) => {
    const group = creationGroup({
      creationKind,
      records: [
        {
          version_uuid: 'v-created',
          entity_kind: entityType,
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
    });
    const onPreview = jest.fn();
    const onRestore = jest.fn();
    renderItem({ group, entityType, onPreview, onRestore });

    await userEvent.click(
      screen.getByRole('button', { name: 'Preview this version' }),
    );
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith(group);
    expect(onRestore).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('version-history-action-row'),
    ).not.toBeInTheDocument();
  },
);

test('an empty historical group with no creationKind has a preview action', () => {
  renderItem({ group: creationGroup({ creationKind: undefined }) });

  expect(
    screen.getByRole('button', { name: 'Preview this version' }),
  ).toBeVisible();
});

test.each<{ entityType: VersionedEntityType; isCurrent: boolean }>([
  { entityType: 'chart', isCurrent: false },
  { entityType: 'chart', isCurrent: true },
  { entityType: 'dashboard', isCurrent: false },
  { entityType: 'dashboard', isCurrent: true },
])(
  '$entityType change rows preview without duplicating group actions (current: $isCurrent)',
  async ({ entityType, isCurrent }) => {
    const records: ActivityRecord[] = ['metrics', 'filters'].map(kind => ({
      version_uuid: 'version-uuid',
      entity_kind: entityType,
      entity_uuid: 'entity-uuid',
      entity_name: 'Example',
      entity_deleted: false,
      entity_deletion_state: null,
      source: 'self',
      transaction_id: 7,
      action_kind: null,
      issued_at: '2026-08-31T17:46:00',
      changed_by: null,
      kind,
      operation: 'update',
      path: [kind],
      from_value: null,
      to_value: null,
      summary: '',
      impact: null,
    }));
    const group = makeGroup({ records });
    const onPreview = jest.fn();
    const onExitPreview = jest.fn();
    const onOpenAsNew = jest.fn();
    const onRestore = jest.fn();
    renderItem({
      entityType,
      isCurrent,
      group,
      onPreview,
      onExitPreview,
      onOpenAsNew,
      onRestore,
    });

    await userEvent.click(screen.getByRole('button', { name: /Aug 31, 2026/ }));
    const rows = screen.getAllByTestId('version-history-action-row');
    expect(rows).toHaveLength(2);
    rows.forEach(row => {
      expect(
        within(row).queryByRole('button', { name: 'More actions' }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getAllByRole('button', { name: 'More actions' }),
    ).toHaveLength(1);

    await userEvent.click(rows[0]);
    rows[1].focus();
    fireEvent.keyDown(rows[1], { key: 'Enter' });
    fireEvent.keyDown(rows[1], { key: ' ' });
    if (isCurrent) {
      expect(onExitPreview).toHaveBeenCalledTimes(3);
      expect(onPreview).not.toHaveBeenCalled();
    } else {
      expect(onPreview).toHaveBeenCalledTimes(3);
      expect(onPreview).toHaveBeenLastCalledWith(group);
      expect(onExitPreview).not.toHaveBeenCalled();
    }

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    if (isCurrent) {
      expect(
        screen.queryByRole('menuitem', { name: 'Restore this version' }),
      ).not.toBeInTheDocument();
    } else {
      expect(
        screen.getByRole('menuitem', { name: 'Restore this version' }),
      ).toBeInTheDocument();
    }
    await userEvent.click(
      screen.getByRole('menuitem', { name: `Open as new ${entityType}` }),
    );
    expect(onOpenAsNew).toHaveBeenCalledTimes(1);
    expect(onOpenAsNew).toHaveBeenCalledWith(group);
    expect(onRestore).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenCalledTimes(isCurrent ? 0 : 3);
    expect(onExitPreview).toHaveBeenCalledTimes(isCurrent ? 3 : 0);
    expect(screen.getAllByTestId('version-history-action-row')).toHaveLength(2);
  },
);

test.each([false, true])(
  'latest-save metadata describes its header independently of aria-current (%s)',
  marksCurrentState => {
    const record: ActivityRecord = {
      version_uuid: 'version-uuid',
      entity_kind: 'chart',
      entity_uuid: 'entity-uuid',
      entity_name: 'My chart',
      entity_deleted: false,
      entity_deletion_state: null,
      source: 'self',
      transaction_id: 7,
      action_kind: null,
      issued_at: '2026-08-31T17:46:00',
      changed_by: null,
      kind: 'metrics',
      operation: 'update',
      path: ['metrics'],
      from_value: null,
      to_value: null,
      summary: '',
      impact: null,
    };
    const group = makeGroup({
      records: [record],
      changedBy: { id: 1, first_name: 'Ada', last_name: 'Lovelace' },
    });
    const { container: latest } = renderItem({
      group,
      isCurrent: true,
      marksCurrentState,
    });
    const { container: historical } = renderItem({ group });
    const latestHeader = within(latest).getByRole('button', {
      name: /Aug 31, 2026/,
    });
    const historicalHeader = within(historical).getByRole('button', {
      name: /Aug 31, 2026/,
    });

    expect(latestHeader).toHaveAccessibleDescription(
      /Latest save · Ada Lovelace · 8\/31\/2026/,
    );
    expect(historicalHeader).toHaveAccessibleDescription(
      /^Ada Lovelace · 8\/31\/2026/,
    );
    if (marksCurrentState) {
      expect(latestHeader).toHaveAttribute('aria-current', 'true');
    } else {
      expect(latestHeader).not.toHaveAttribute('aria-current');
    }
  },
);
