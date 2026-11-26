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
import { render, screen } from 'spec/helpers/testing-library';
import type { TimeRangeLimits } from '@superset-ui/core';
import controlMap from 'src/explore/components/controls';
import { ExploreTimeRangeLimitsContext } from './ExploreTimeRangeLimitsContext';

jest.mock(
  'src/explore/components/controls/LayerConfigsControl/LayerConfigsControl',
  () => () => null,
);

jest.mock('./DateFilterLabel', () => ({
  __esModule: true,
  default: (props: { timeRangeLimits?: object; value?: string }) => (
    <div data-test="picker">
      {JSON.stringify({
        value: props.value,
        timeRangeLimits: props.timeRangeLimits ?? null,
      })}
    </div>
  ),
}));

const LIMITS: TimeRangeLimits = {
  levels: [
    {
      source: 'dataset',
      policy: {
        max_span: { quantity: 30, time_grain: 'P1D' },
        max_look_back: null,
        max_look_forward: null,
      },
    },
  ],
  timezone: 'UTC',
};

const LegacyTimeRange = (
  controlMap as unknown as Record<
    string,
    (props: {
      name: string;
      value: string;
      onChange: () => void;
    }) => JSX.Element
  >
).DateFilterControl;

const picker = () => JSON.parse(screen.getByTestId('picker').textContent!);

test('the legacy time_range control gets the Explore limits', () => {
  render(
    <ExploreTimeRangeLimitsContext.Provider value={LIMITS}>
      <LegacyTimeRange
        name="time_range"
        value="Last week"
        onChange={jest.fn()}
      />
    </ExploreTimeRangeLimitsContext.Provider>,
  );
  expect(picker()).toEqual({ value: 'Last week', timeRangeLimits: LIMITS });
});

// Guard test: passes on the base too.
test('the legacy time_range control gets no limits outside Explore', () => {
  render(
    <LegacyTimeRange
      name="time_range"
      value="Last week"
      onChange={jest.fn()}
    />,
  );
  expect(picker()).toEqual({ value: 'Last week', timeRangeLimits: null });
});
