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
import { openInNewTab } from 'src/utils/navigationUtils';
import { resolveEntityId } from './api';
import { openRelatedEntity } from './openRelated';
import type { ActivityRecord } from './types';

jest.mock('src/utils/navigationUtils', () => ({
  openInNewTab: jest.fn(),
}));
jest.mock('./api', () => ({
  resolveEntityId: jest.fn(),
}));

const mockedResolveEntityId = resolveEntityId as jest.Mock;
const mockedOpenInNewTab = openInNewTab as jest.Mock;

const record = (overrides: Partial<ActivityRecord> = {}): ActivityRecord =>
  ({
    entity_kind: 'chart',
    entity_uuid: 'uuid-1',
    entity_name: 'My chart',
    ...overrides,
  }) as ActivityRecord;

afterEach(() => {
  jest.clearAllMocks();
});

test('opens the resolved chart in a new tab', async () => {
  mockedResolveEntityId.mockResolvedValue(42);
  const onError = jest.fn();

  await openRelatedEntity(record(), onError);

  expect(mockedOpenInNewTab).toHaveBeenCalledWith('/explore/?slice_id=42');
  expect(onError).not.toHaveBeenCalled();
});

test('opens the resolved dashboard with a post-route_base path', async () => {
  mockedResolveEntityId.mockResolvedValue(7);
  const onError = jest.fn();

  await openRelatedEntity(record({ entity_kind: 'dashboard' }), onError);

  expect(mockedOpenInNewTab).toHaveBeenCalledWith('/dashboard/7/');
});

test('reports an error when the record has no uuid', async () => {
  const onError = jest.fn();

  await openRelatedEntity(record({ entity_uuid: null }), onError);

  expect(onError).toHaveBeenCalledWith('Could not find My chart');
  expect(mockedResolveEntityId).not.toHaveBeenCalled();
  expect(mockedOpenInNewTab).not.toHaveBeenCalled();
});

test('reports an error when the uuid does not resolve to an id', async () => {
  mockedResolveEntityId.mockResolvedValue(null);
  const onError = jest.fn();

  await openRelatedEntity(record(), onError);

  expect(onError).toHaveBeenCalledWith('Could not find My chart');
  expect(mockedOpenInNewTab).not.toHaveBeenCalled();
});

test('reports an error when the id lookup fails', async () => {
  mockedResolveEntityId.mockRejectedValue(new Error('boom'));
  const onError = jest.fn();

  await openRelatedEntity(record(), onError);

  expect(onError).toHaveBeenCalledWith('Could not find My chart');
  expect(mockedOpenInNewTab).not.toHaveBeenCalled();
});
