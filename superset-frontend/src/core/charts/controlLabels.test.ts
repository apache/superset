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
 * What an extension gets when it asks what a chart's controls are called.
 *
 * The keys inside a chart's `params` are Explore control names, which an
 * extension describing a change has no way to resolve: the control panel
 * registry is the host's. Without this it can only print the raw keys --
 * `adhoc_filters`, `color_by_primary_axis`, `axisTicks`.
 */

import getControlsForVizType from 'src/utils/getControlsForVizType';
import { charts } from '.';

jest.mock('src/utils/getControlsForVizType', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const lookup = getControlsForVizType as unknown as jest.Mock;

afterEach(() => lookup.mockReset());

test('a control is returned under its own name, by its label', () => {
  lookup.mockReturnValue({
    adhoc_filters: { label: 'Filters' },
    row_limit: { label: 'Row limit' },
  });

  expect(charts.controlLabels('table')).toEqual({
    adhoc_filters: 'Filters',
    row_limit: 'Row limit',
  });
});

test('a label that is not a plain string is left out, not stringified', () => {
  // A dynamic control's label can be a node or a function. Neither can go
  // into a sentence, and `[object Object]` beside a setting name is worse
  // than the raw key the caller falls back to.
  lookup.mockReturnValue({
    plain: { label: 'Plain' },
    node: { label: { type: 'span' } },
    dynamic: { label: () => 'Computed' },
    missing: {},
  });

  expect(charts.controlLabels('table')).toEqual({ plain: 'Plain' });
});

test('a visualization type the registry does not know yields nothing', () => {
  // Empty, not a throw: the caller then shows raw keys, which is what it
  // would have shown anyway. Failing here would take the panel down over a
  // cosmetic lookup.
  lookup.mockImplementation(() => {
    throw new Error('no such viz type');
  });

  expect(charts.controlLabels('not-a-viz')).toEqual({});
});

test('a registry answering nothing at all yields nothing', () => {
  lookup.mockReturnValue(undefined);

  expect(charts.controlLabels('table')).toEqual({});
});

test('an empty visualization type is not asked about', () => {
  expect(charts.controlLabels('')).toEqual({});
  expect(lookup).not.toHaveBeenCalled();
});
