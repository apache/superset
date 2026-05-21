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
import { groupVersionsByDate } from '../utils/groupVersionsByDate';
import { Version } from '../types';

function makeVersion(uuid: string, isoDate: string): Version {
  return {
    version_uuid: uuid,
    version_number: 1,
    transaction_id: 1,
    operation_type: 'update',
    issued_at: isoDate,
    changed_by: null,
    changes: [],
  };
}

test('groupVersionsByDate puts the latest row in its own "Current version" group', () => {
  const now = new Date().toISOString();
  const groups = groupVersionsByDate([makeVersion('a', now)]);
  expect(groups[0].label).toMatch(/Current version/);
  expect(groups[0].versions).toHaveLength(1);
});

test('groupVersionsByDate separates today vs older entries', () => {
  const now = new Date();
  const today = now.toISOString();
  const older = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const groups = groupVersionsByDate([
    makeVersion('a', today),
    makeVersion('b', today),
    makeVersion('c', older),
  ]);
  // Current + Today (b) + older (c)
  expect(groups.length).toBeGreaterThanOrEqual(3);
  expect(groups[0].versions[0].version_uuid).toBe('a');
});

test('groupVersionsByDate returns an empty array for no versions', () => {
  expect(groupVersionsByDate([])).toEqual([]);
});
