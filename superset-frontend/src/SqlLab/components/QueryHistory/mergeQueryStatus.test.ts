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
import { QueryState, testQueryResponse } from '@superset-ui/core';
import { mergeQueryStatus } from './mergeQueryStatus';

// remoteBase and localBase deliberately differ on backend-only metadata
// (queryId, tab, executedSql) that the merge bundle never touches, not just
// on the seven bundle fields. If they only differed on the bundle fields,
// `{...remoteQuery, <bundle>}` and `{...localQuery, <bundle>}` would be
// structurally equal and toEqual/toBe could not tell a correct base from a
// wrong one — see the "keeps the snapshot's backend-only metadata" test
// below, which exists specifically to catch that class of regression.
const remoteBase = {
  ...testQueryResponse,
  queryId: 692,
  tab: 'Untitled Query 16',
  executedSql: 'SELECT * from "FCC 2018 Survey"\nLIMIT 1001',
  state: QueryState.Running,
  progress: 0,
  rows: 0,
  startDttm: 1000,
  endDttm: undefined as unknown as number,
  resultsKey: null,
  errorMessage: null,
};

const localBase = {
  ...testQueryResponse,
  queryId: undefined as unknown as number,
  tab: 'stale local tab',
  executedSql: undefined as unknown as string,
  state: QueryState.Success,
  progress: 100,
  rows: 443,
  startDttm: 2000,
  endDttm: 3000,
  resultsKey: 'a-results-key',
  errorMessage: null,
};

test('both non-concluded: returns the remote row unchanged', () => {
  const remote = { ...remoteBase, state: QueryState.Running };
  const local = { ...localBase, state: QueryState.Scheduled };

  expect(mergeQueryStatus(remote, local)).toBe(remote);
});

test('remote concluded, local not: returns the remote row unchanged', () => {
  const remote = { ...remoteBase, state: QueryState.Success };
  const local = { ...localBase, state: QueryState.Running };

  expect(mergeQueryStatus(remote, local)).toBe(remote);
});

test('both concluded: declines to override, returns the remote row unchanged', () => {
  const remote = { ...remoteBase, state: QueryState.Success };
  const local = { ...localBase, state: QueryState.Stopped };

  expect(mergeQueryStatus(remote, local)).toBe(remote);
});

test('local concluded, remote not: local supplies status fields and both timestamps together', () => {
  const remote = { ...remoteBase, state: QueryState.Running };
  const local = { ...localBase, state: QueryState.Success };

  expect(mergeQueryStatus(remote, local)).toEqual({
    ...remote,
    state: QueryState.Success,
    progress: 100,
    rows: 443,
    startDttm: 2000,
    endDttm: 3000,
    resultsKey: 'a-results-key',
    errorMessage: null,
  });
});

test('local concluded, remote not: undefined local fields fall back to the remote value', () => {
  const remote = {
    ...remoteBase,
    state: QueryState.Running,
    startDttm: 1000,
    endDttm: 1500,
    resultsKey: 'remote-results-key',
    errorMessage: 'remote error',
  };
  const local = {
    ...localBase,
    state: QueryState.Success,
    startDttm: undefined as unknown as number,
    endDttm: undefined as unknown as number,
    resultsKey: undefined as unknown as string,
    errorMessage: undefined as unknown as string,
  };

  const merged = mergeQueryStatus(remote, local);

  expect(merged.startDttm).toBe(1000);
  expect(merged.endDttm).toBe(1500);
  expect(merged.resultsKey).toBe('remote-results-key');
  expect(merged.errorMessage).toBe('remote error');
});

test('local concluded, remote not: a null local field overrides a remote value (does not fall back)', () => {
  const remote = {
    ...remoteBase,
    state: QueryState.Running,
    resultsKey: 'remote-results-key',
    errorMessage: 'remote error',
  };
  const local = {
    ...localBase,
    state: QueryState.Failed,
    resultsKey: null,
    errorMessage: null,
  };

  const merged = mergeQueryStatus(remote, local);

  expect(merged.resultsKey).toBeNull();
  expect(merged.errorMessage).toBeNull();
});

test('local concluded, remote not: keeps the snapshot-only metadata (queryId, tab, executedSql)', () => {
  const remote = { ...remoteBase, state: QueryState.Running };
  const local = { ...localBase, state: QueryState.Success };

  const merged = mergeQueryStatus(remote, local);

  expect(merged.queryId).toBe(692);
  expect(merged.tab).toBe('Untitled Query 16');
  expect(merged.executedSql).toBe(
    'SELECT * from "FCC 2018 Survey"\nLIMIT 1001',
  );
});
