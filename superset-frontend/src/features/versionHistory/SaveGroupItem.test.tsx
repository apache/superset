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
import { fireEvent, render, within } from 'spec/helpers/testing-library';
import type { SaveGroup } from './types';
import SaveGroupItem, { SaveGroupItemProps } from './SaveGroupItem';

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
      isPreviewed={false}
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

test('the current version carries the active highlight at rest', () => {
  // The "you are here" contract: the current version at rest gets exactly
  // the same treatment a historical version gets while previewed, and a
  // resting historical version gets neither.
  const { container: currentAtRest } = renderItem({ isCurrent: true });
  const { container: previewedHistorical } = renderItem({ isPreviewed: true });
  const { container: restingHistorical } = renderItem();

  expect(groupBackground(currentAtRest)).toBe(
    groupBackground(previewedHistorical),
  );
  expect(groupBackground(restingHistorical)).not.toBe(
    groupBackground(currentAtRest),
  );
});

test('group icons are semantic: check-circle for current, save for history', () => {
  const { container: current } = renderItem({ isCurrent: true });
  const { container: historical } = renderItem();

  expect(
    within(current).getByRole('img', { name: 'check-circle' }),
  ).toBeInTheDocument();
  expect(
    within(current).queryByRole('img', { name: 'save' }),
  ).not.toBeInTheDocument();

  expect(
    within(historical).getByRole('img', { name: 'save' }),
  ).toBeInTheDocument();
  expect(
    within(historical).queryByRole('img', { name: 'check-circle' }),
  ).not.toBeInTheDocument();
});

test('rows of the current group show the active timeline dot at rest', () => {
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
  } as SaveGroup['records'][number];
  const { container: current } = renderItem({
    isCurrent: true,
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
