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
  closeOpenedTab,
  navigateOpenedTab,
  openBlankTab,
} from 'src/utils/navigationUtils';
import { resolveEntityId } from './api';
import { openRelatedEntity } from './openRelated';
import type { ActivityRecord } from './types';

jest.mock('src/utils/navigationUtils', () => ({
  openBlankTab: jest.fn(),
  navigateOpenedTab: jest.fn(),
  closeOpenedTab: jest.fn(),
}));
jest.mock('./api', () => ({
  resolveEntityId: jest.fn(),
}));

const mockedResolveEntityId = resolveEntityId as jest.Mock;
const mockedOpenBlankTab = openBlankTab as jest.Mock;
const mockedNavigateOpenedTab = navigateOpenedTab as jest.Mock;
const mockedCloseOpenedTab = closeOpenedTab as jest.Mock;

const claimedTab = { location: { replace: jest.fn() } } as unknown as Window;

const record = (overrides: Partial<ActivityRecord> = {}): ActivityRecord =>
  ({
    entity_kind: 'chart',
    entity_uuid: 'uuid-1',
    entity_name: 'My chart',
    ...overrides,
  }) as ActivityRecord;

beforeEach(() => {
  mockedOpenBlankTab.mockReturnValue(claimedTab);
});

afterEach(() => {
  jest.clearAllMocks();
});

test('claims the tab before the id resolves, then navigates it', async () => {
  // window.open after the resolve await is silently refused on Safari (and
  // on any browser once transient activation lapses) — the tab must be
  // claimed synchronously in the click's task.
  let resolveId: (value: number) => void = () => {};
  mockedResolveEntityId.mockReturnValue(
    new Promise(resolve => {
      resolveId = resolve;
    }),
  );
  const onError = jest.fn();

  const pending = openRelatedEntity(record(), onError);
  expect(mockedOpenBlankTab).toHaveBeenCalledTimes(1);
  expect(mockedNavigateOpenedTab).not.toHaveBeenCalled();

  resolveId(42);
  await pending;

  expect(mockedNavigateOpenedTab).toHaveBeenCalledWith(
    claimedTab,
    '/explore/?slice_id=42',
  );
  expect(onError).not.toHaveBeenCalled();
});

test('opens the resolved dashboard with a post-route_base path', async () => {
  mockedResolveEntityId.mockResolvedValue(7);
  const onError = jest.fn();

  await openRelatedEntity(record({ entity_kind: 'dashboard' }), onError);

  expect(mockedNavigateOpenedTab).toHaveBeenCalledWith(
    claimedTab,
    '/dashboard/7/',
  );
});

test('reports an error when the record has no uuid', async () => {
  const onError = jest.fn();

  await openRelatedEntity(record({ entity_uuid: null }), onError);

  expect(onError).toHaveBeenCalledWith('Could not find My chart');
  expect(mockedResolveEntityId).not.toHaveBeenCalled();
  // Nothing was claimed, so nothing to close.
  expect(mockedOpenBlankTab).not.toHaveBeenCalled();
});

test('closes the claimed tab when the uuid does not resolve to an id', async () => {
  // Leaving it open would strand the user on about:blank.
  mockedResolveEntityId.mockResolvedValue(null);
  const onError = jest.fn();

  await openRelatedEntity(record(), onError);

  expect(onError).toHaveBeenCalledWith('Could not find My chart');
  expect(mockedNavigateOpenedTab).not.toHaveBeenCalled();
  expect(mockedCloseOpenedTab).toHaveBeenCalledWith(claimedTab);
});

test('closes the claimed tab when the id lookup fails', async () => {
  mockedResolveEntityId.mockRejectedValue(new Error('boom'));
  const onError = jest.fn();

  await openRelatedEntity(record(), onError);

  expect(onError).toHaveBeenCalledWith('Could not find My chart');
  expect(mockedNavigateOpenedTab).not.toHaveBeenCalled();
  expect(mockedCloseOpenedTab).toHaveBeenCalledWith(claimedTab);
});
