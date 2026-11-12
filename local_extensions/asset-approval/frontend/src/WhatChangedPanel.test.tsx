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
/**
 * @fileoverview A request with nothing to read cannot be approved from the panel.
 *
 * Whatever else is drawn, an open request must not open to an empty panel that
 * says nothing changed with Approve enabled: that is how a metric delete (a
 * keyword over an empty body) read before keywords were shown.
 */

import { charts } from '@apache-superset/core';
import { render, screen } from '@testing-library/react';
import WhatChangedPanel from './WhatChangedPanel';
import type { ChangeRequest } from './types';

const KEYWORD = {
  field: 'delete_metric_ids',
  keyword: true,
  summary: 'Deletes 1 metric from this dataset: total_revenue. Anything that uses them loses them.',
  after: 'total_revenue',
};

const request = (over: Partial<ChangeRequest> = {}): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'chart',
    asset_id: 7,
    asset_title: 'Signups by week',
    status: 'pending',
    operation: 'update',
    is_open: true,
    is_author: false,
    can_approve: true,
    author: { id: 2, first_name: 'Mo', last_name: 'Maker' },
    changed_on: new Date().toISOString(),
    changed_fields: [],
    proposed: {},
    changes: [{ field: 'slice_name', before: 'Old', after: 'New' }],
    ...over,
  }) as unknown as ChangeRequest;

const show = (changeRequest: ChangeRequest) =>
  render(
    <WhatChangedPanel
      changeRequest={changeRequest}
      onClose={jest.fn()}
      review={{ busy: false, onApprove: jest.fn(), onRequestChanges: jest.fn() }}
    />,
  );

const approve = () => screen.getByTestId('panel-approve').closest('button')!;

test('a request with something to read can be approved', () => {
  show(request());

  expect(approve()).toBeEnabled();
  expect(screen.queryByTestId('review-blocked')).not.toBeInTheDocument();
});

test('a pending request with nothing in it does not say nothing changed beside an enabled Approve', () => {
  // The defect: a metric delete over an empty body was held, opened to
  // 'Nothing differs from the live version', and Approve was enabled.
  show(request({ changes: [] }));

  expect(approve()).toBeDisabled();
  expect(screen.getByTestId('review-blocked')).toBeInTheDocument();
  expect(screen.queryByText('Nothing differs from the live version.')).not.toBeInTheDocument();
});

test('a request the server reports unreviewable shows its raw call and withholds Approve', () => {
  show(
    request({
      review_blocked: 'There is nothing here the reviewer can check.',
      changes: [
        {
          field: 'captured_call',
          unreadable: true,
          summary: 'The request as it was captured',
          after: '{"body": {}}',
        },
      ],
    }),
  );

  expect(approve()).toBeDisabled();
  expect(screen.getByTestId('review-blocked')).toHaveTextContent('nothing here the reviewer can check');
  expect(screen.getByTestId('captured-call')).toHaveTextContent('{"body": {}}');
});

test('a keyword over an empty body is shown, and the request can be approved', () => {
  show(request({ changes: [KEYWORD] }));

  expect(screen.getByTestId('change-summary')).toHaveTextContent('Deletes 1 metric');
  expect(screen.getByText('delete_metric_ids')).toBeInTheDocument();
  expect(approve()).toBeEnabled();
});

test('a field with no values to read withholds Approve', () => {
  // Names without values are not a change a reviewer can judge.
  show(request({ changes: [{ field: 'params', opaque: true, keys: ['a', 'b'] }] }));

  expect(approve()).toBeDisabled();
  expect(screen.getByTestId('review-blocked')).toHaveTextContent('params');
});

test('a delete shows a keyword it was called with', () => {
  show(request({ operation: 'delete', changes: [KEYWORD] }));

  expect(screen.getByText('This asset would be removed once approved.')).toBeInTheDocument();
  expect(screen.getByTestId('change-summary')).toBeInTheDocument();
  expect(approve()).toBeEnabled();
});

test('a closed request is history and is not flagged', () => {
  show(request({ status: 'approved', is_open: false, changes: [] }));

  expect(screen.queryByTestId('review-blocked')).not.toBeInTheDocument();
});

/**
 * sc-129075, the half about what the keys inside `params` are called.
 *
 * `FIELD_LABELS` in `ChangeList` names storage columns. The keys *inside*
 * `params` are Explore control names, and with no mapping the panel read
 * "Chart configuration: adhoc_filters, axisTicks, color_by_primary_axis
 * and 75 more" -- internal names a reviewer deciding whether to publish
 * should not have to know.
 *
 * Core resolved them and the move into the extension dropped the producer
 * while keeping the consumer, so `controls` was permanently undefined and
 * it type-checked. The host answers now, because the control registry is
 * its own.
 */
describe('Explore control names inside params', () => {
  const controlLabels = charts.controlLabels as unknown as jest.Mock;

  afterEach(() => {
    controlLabels.mockReset();
    controlLabels.mockReturnValue({});
  });

  test('[129075] a params key is shown by the label its author saw', () => {
    controlLabels.mockReturnValue({ adhoc_filters: 'Filters' });

    show(
      request({
        proposed: { params: JSON.stringify({ viz_type: 'table' }) },
        changes: [
          {
            field: 'params',
            entries: [
              { kind: 'changed', key: 'adhoc_filters', before: 'a', after: 'b' },
            ],
          },
        ],
      } as unknown as Partial<ChangeRequest>),
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.queryByText('adhoc_filters')).not.toBeInTheDocument();
    expect(controlLabels).toHaveBeenCalledWith('table');
  });

  test('[129075] a key the registry does not know keeps its raw name', () => {
    // The fallback has to stay: a control Superset has no label for is
    // better shown by its key than not shown at all.
    controlLabels.mockReturnValue({ adhoc_filters: 'Filters' });

    show(
      request({
        proposed: { params: JSON.stringify({ viz_type: 'table' }) },
        changes: [
          {
            field: 'params',
            entries: [
              { kind: 'changed', key: 'mystery_knob', before: 'a', after: 'b' },
            ],
          },
        ],
      } as unknown as Partial<ChangeRequest>),
    );

    expect(screen.getByText('mystery_knob')).toBeInTheDocument();
  });

  test('[129075] a dashboard is not relabelled with chart control names', () => {
    // Keying on the field name alone left this reachable by anything
    // carrying a `params` string with a `viz_type` in it.
    show(
      request({
        asset_type: 'dashboard',
        proposed: { params: JSON.stringify({ viz_type: 'table' }) },
        changes: [
          {
            field: 'params',
            entries: [
              { kind: 'changed', key: 'adhoc_filters', before: 'a', after: 'b' },
            ],
          },
        ],
      } as unknown as Partial<ChangeRequest>),
    );

    expect(controlLabels).not.toHaveBeenCalled();
  });
});
