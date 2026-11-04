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

/**
 * @fileoverview The dataset review dialog, and the fields it had no tab for.
 *
 * Source, Metrics and Columns were the only tabs, and the server emitted
 * only those three fields, so everything else a dataset change carries was
 * replayed on approve and shown nowhere. The dialog opened on `columns` and
 * said "No column changed." -- which was true, and was read as "nothing
 * changed" (129075).
 *
 * This is the **extension's** copy of the dialog, which is the one the
 * Approvals page mounts. The core copy under
 * `superset-frontend/src/features/changeManagement` is a second, separate
 * file: `Approvals.tsx` cannot import it, because Module Federation shares
 * a module by its exact request. Both are changed together or the fix is on
 * the path a test uses and not on the path the reviewer uses.
 */

import { render, screen } from '@testing-library/react';
import DatasetReviewModal from './DatasetReviewModal';
import { datasetChangeCount } from './display';
import type { ChangeRequest, DatasetDetail } from './types';

const detail = (over: Partial<DatasetDetail> = {}): DatasetDetail => ({
  impact: { charts: 2, dashboards: 1 },
  ...over,
});

const changeRequest = (dataset_detail: DatasetDetail): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'dataset',
    asset_id: 9,
    asset_title: 'sales',
    status: 'pending',
    author: { id: 2, first_name: 'Mo', last_name: 'Maker' },
    reviewer: null,
    note: null,
    review_note: null,
    submitted_at: new Date().toISOString(),
    changed_on: new Date().toISOString(),
    decided_at: null,
    changed_fields: [],
    changes: [],
    operation: 'update',
    proposed: {},
    dataset_detail,
  }) as unknown as ChangeRequest;

const show = (dataset_detail: DatasetDetail) =>
  render(
    <DatasetReviewModal
      changeRequest={changeRequest(dataset_detail)}
      open
      onClose={() => {}}
    />,
  );

const SETTINGS: DatasetDetail = {
  impact: { charts: 2, dashboards: 1 },
  settings: [
    {
      field: 'fetch_values_predicate',
      before: "ds > '2020-01-01'",
      after: '1 = 1',
    },
  ],
};

test('a change with nothing but settings opens on the Settings tab', () => {
  // The whole of the complaint: landing on an empty Columns tab and
  // reading "No column changed." over a real change.
  show(SETTINGS);

  expect(screen.getByText('1 = 1')).toBeInTheDocument();
  expect(screen.queryByText('No column changed.')).not.toBeInTheDocument();
});

test('the Settings tab carries a count', () => {
  show(SETTINGS);

  expect(screen.getByTestId('dataset-tab-settings').textContent).toContain('1');
});

test('the live value is shown beside the proposed one', () => {
  show(SETTINGS);

  expect(screen.getByText("ds > '2020-01-01'")).toBeInTheDocument();
});

test('a shortened value says that it was shortened', () => {
  // Never silently dropped: approving what you cannot see is the one thing
  // this feature exists to prevent.
  show(
    detail({
      settings: [
        { field: 'template_params', before: null, after: 'x', truncated: true },
      ],
    }),
  );

  expect(screen.getByText('(shortened)')).toBeInTheDocument();
});

test('a structural change still says the field moved', () => {
  show(
    detail({ settings: [{ field: 'owners', opaque: true } as never] }),
  );

  expect(screen.getByText('owners')).toBeInTheDocument();
});

test('a change with no other settings keeps a truthful empty tab', () => {
  // The tab exists on every dataset review, so the sentence under it has
  // to be true when nothing is there.
  show(detail({ sql: { before: 'SELECT 1', after: 'SELECT 2' } }));

  expect(screen.getByTestId('dataset-tab-settings').textContent).toContain('0');
  // Source has the change, so that is where the dialog opens.
  expect(screen.getByText('SELECT 2')).toBeInTheDocument();
});

test('a structural change still wins the opening tab', () => {
  // Settings is last in the list, so a SQL or column change still opens
  // where a reviewer expects it to.
  show({ ...SETTINGS, sql: { before: 'SELECT 1', after: 'SELECT 2' } });

  expect(screen.getByText('SELECT 2')).toBeInTheDocument();
});

test('the panel count includes the settings rows', () => {
  // Or the header reads "0 changes" over a dialog that lists one -- the
  // exact contradiction `WhatChangedPanel` already had to fix once.
  expect(datasetChangeCount(SETTINGS)).toBe(1);
  expect(
    datasetChangeCount({
      ...SETTINGS,
      sql: { before: 'SELECT 1', after: 'SELECT 2' },
    }),
  ).toBe(2);
});
