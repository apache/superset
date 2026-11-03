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
 * @fileoverview A chart change names its settings the way Explore does.
 *
 * The keys inside `params` are Explore control names and had no mapping at
 * all, so the panel read "Chart configuration: adhoc_filters, axisTicks,
 * color_by_primary_axis and 75 more": internal names a reviewer deciding
 * whether to publish should not have to know (sc-129075).
 */

import { render, screen } from 'spec/helpers/testing-library';
import WhatChangedPanel from './WhatChangedPanel';
import type { ChangeRequest } from './types';

jest.mock('src/utils/getControlsForVizType', () => ({
  __esModule: true,
  default: jest.fn(),
}));
// The dataset tab pulls in a page's worth of chrome and is not what this
// file is about.
jest.mock('./DatasetReview', () => () => null);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const getControls = require('src/utils/getControlsForVizType').default;

const request = (overrides: Partial<ChangeRequest> = {}): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'chart',
    asset_id: 7,
    asset_title: 'Signups by week',
    status: 'pending',
    operation: 'update',
    is_open: true,
    is_author: false,
    can_approve: false,
    author: { id: 2, first_name: 'Mo', last_name: 'Maker' },
    changed_on: new Date().toISOString(),
    changed_fields: ['params'],
    proposed: { params: JSON.stringify({ viz_type: 'table' }) },
    changes: [
      { field: 'params', opaque: true, keys: ['adhoc_filters', 'groupby'] },
    ],
    ...overrides,
  }) as unknown as ChangeRequest;

const show = (changeRequest: ChangeRequest) =>
  render(<WhatChangedPanel changeRequest={changeRequest} onClose={jest.fn()} />, {
    useRedux: true,
    useRouter: true,
  });

beforeEach(() => {
  getControls.mockReset();
  getControls.mockReturnValue({
    adhoc_filters: { label: 'Filters' },
    groupby: { label: 'Dimensions' },
  });
});

test('a control is named the way Explore names it', () => {
  show(request());

  expect(screen.getByText(/Filters, Dimensions/)).toBeInTheDocument();
});

test('the labels are looked up for the chart being reviewed', () => {
  show(request());

  expect(getControls).toHaveBeenCalledWith('table');
});

test('a key that is not a control keeps its raw name', () => {
  // `viz_type` and `datasource` are not controls, and inventing labels for
  // them would be worse than leaving them alone.
  getControls.mockReturnValue({ groupby: { label: 'Dimensions' } });

  show(
    request({
      changes: [
        { field: 'params', opaque: true, keys: ['groupby', 'datasource'] },
      ],
    } as Partial<ChangeRequest>),
  );

  expect(screen.getByText(/Dimensions, datasource/)).toBeInTheDocument();
});

test('a label that is not a plain string is not dropped into the sentence', () => {
  // Some controls carry a node or a function for a dynamic label.
  getControls.mockReturnValue({
    adhoc_filters: { label: () => 'computed' },
    groupby: { label: 'Dimensions' },
  });

  show(request());

  expect(screen.getByText(/adhoc_filters, Dimensions/)).toBeInTheDocument();
});

test('an unparseable params payload leaves every key as it was', () => {
  show(request({ proposed: { params: '{not json' } } as Partial<ChangeRequest>));

  expect(screen.getByText(/adhoc_filters, groupby/)).toBeInTheDocument();
});

test('a viz type the registry does not know leaves every key as it was', () => {
  getControls.mockReturnValue(undefined);

  show(request());

  expect(screen.getByText(/adhoc_filters, groupby/)).toBeInTheDocument();
});

test('a dashboard change does not get chart control labels', () => {
  // `json_metadata` keys are not Explore controls, so a coincidental name
  // collision must not relabel them.
  getControls.mockReturnValue({ groupby: { label: 'Dimensions' } });

  show(
    request({
      asset_type: 'dashboard',
      changed_fields: ['json_metadata'],
      changes: [
        { field: 'json_metadata', opaque: true, keys: ['groupby', 'color_scheme'] },
      ],
    } as Partial<ChangeRequest>),
  );

  expect(screen.getByText(/groupby, color_scheme/)).toBeInTheDocument();
});
