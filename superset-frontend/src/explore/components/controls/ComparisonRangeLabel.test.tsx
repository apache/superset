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
import { act, render, screen, waitFor } from 'spec/helpers/testing-library';
import { fetchTimeRange } from '@superset-ui/core';
import { ComparisonRangeLabel } from './ComparisonRangeLabel';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  fetchTimeRange: jest.fn(),
}));

const mockedFetchTimeRange = fetchTimeRange as jest.MockedFunction<
  typeof fetchTimeRange
>;

const HEADER = 'Actual range for comparison';
const CURRENT_RANGE_LABEL = '2024-03-01 ≤ col < 2024-03-31';
const COMPARISON_LABEL = '2023-03-01 ≤ col < 2023-03-31';

const temporalRangeFilter = {
  expressionType: 'SIMPLE',
  subject: 'order_date',
  operator: 'TEMPORAL_RANGE',
  comparator: '2024-03-01 : 2024-03-31',
  clause: 'WHERE',
};

const nonTemporalFilter = {
  expressionType: 'SIMPLE',
  subject: 'country',
  operator: '==',
  comparator: 'US',
  clause: 'WHERE',
};

function renderLabel(formData: Record<string, unknown>) {
  return render(<ComparisonRangeLabel name="time_compare" />, {
    useRedux: true,
    initialState: {
      explore: {
        form_data: { adhoc_filters: [temporalRangeFilter], ...formData },
      },
    },
  });
}

// Lets the component's promise chain settle so "nothing rendered" assertions
// are made after the async label computation, not before it starts.
const settle = () =>
  act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  });

beforeEach(() => {
  mockedFetchTimeRange.mockReset();
  // The first call resolves the current range, calls with shifts resolve the
  // comparison range.
  mockedFetchTimeRange.mockImplementation(async (_range, _col, shifts) => ({
    value: shifts?.length ? COMPARISON_LABEL : CURRENT_RANGE_LABEL,
  }));
});

test('renders nothing when there is no TEMPORAL_RANGE filter', async () => {
  const { container } = renderLabel({
    adhoc_filters: [nonTemporalFilter],
    time_compare: ['1 year ago'],
  });

  await settle();
  expect(container).toBeEmptyDOMElement();
  expect(mockedFetchTimeRange).not.toHaveBeenCalled();
});

test('renders nothing when a TEMPORAL_RANGE filter has no comparison configured', async () => {
  const { container } = renderLabel({});

  await settle();
  expect(container).toBeEmptyDOMElement();
  expect(mockedFetchTimeRange).not.toHaveBeenCalled();
});

test('renders the comparison range for an explicit time_compare shift', async () => {
  renderLabel({ time_compare: ['1 month ago'] });

  expect(await screen.findByText(HEADER)).toBeInTheDocument();
  expect(screen.getByText(COMPARISON_LABEL)).toBeInTheDocument();
  expect(mockedFetchTimeRange).toHaveBeenCalledWith(
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
    ['1 month ago'],
  );
});

test.each([
  ['y', '1 year ago'],
  ['m', '1 month ago'],
  ['w', '1 week ago'],
])(
  'maps the legacy time_comparison shorthand "%s" to "%s"',
  async (shorthand, expectedShift) => {
    renderLabel({ time_comparison: shorthand });

    expect(await screen.findByText(COMPARISON_LABEL)).toBeInTheDocument();
    expect(mockedFetchTimeRange).toHaveBeenCalledWith(
      temporalRangeFilter.comparator,
      temporalRangeFilter.subject,
      [expectedShift],
    );
  },
);

test('ignores an unknown legacy time_comparison shorthand', async () => {
  const { container } = renderLabel({ time_comparison: 'zzz' });

  await settle();
  expect(container).toBeEmptyDOMElement();
  expect(mockedFetchTimeRange).not.toHaveBeenCalled();
});

test('prefers time_compare over the legacy time_comparison shorthand', async () => {
  renderLabel({ time_compare: ['1 week ago'], time_comparison: 'y' });

  expect(await screen.findByText(COMPARISON_LABEL)).toBeInTheDocument();
  expect(mockedFetchTimeRange).toHaveBeenCalledWith(
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
    ['1 week ago'],
  );
  expect(mockedFetchTimeRange).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    ['1 year ago'],
  );
});

test('custom shift resolves the offset from start_date_offset to the current range start', async () => {
  renderLabel({
    time_compare: ['custom'],
    start_date_offset: '2024-01-01',
  });

  expect(await screen.findByText(COMPARISON_LABEL)).toBeInTheDocument();
  // First the current range is resolved without shifts, then the comparison
  // is requested with the day offset derived from start_date_offset.
  expect(mockedFetchTimeRange).toHaveBeenNthCalledWith(
    1,
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
  );
  expect(mockedFetchTimeRange).toHaveBeenNthCalledWith(
    2,
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
    ['60 days ago'],
  );
});

test('maps the legacy time_comparison shorthand "c" to a custom shift resolved from start_date_offset', async () => {
  renderLabel({ time_comparison: 'c', start_date_offset: '2024-01-01' });

  expect(await screen.findByText(COMPARISON_LABEL)).toBeInTheDocument();
  expect(mockedFetchTimeRange).toHaveBeenNthCalledWith(
    1,
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
  );
  expect(mockedFetchTimeRange).toHaveBeenNthCalledWith(
    2,
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
    ['60 days ago'],
  );
});

test('custom shift without start_date_offset never requests a comparison range', async () => {
  renderLabel({ time_compare: ['custom'] });

  await settle();
  expect(mockedFetchTimeRange).not.toHaveBeenCalled();
  expect(screen.queryByText(COMPARISON_LABEL)).not.toBeInTheDocument();
});

test('custom shift does not request a comparison when start_date_offset is after the current range start', async () => {
  renderLabel({
    time_compare: ['custom'],
    start_date_offset: '2024-06-01',
  });

  await waitFor(() => expect(mockedFetchTimeRange).toHaveBeenCalledTimes(1));
  await settle();
  expect(mockedFetchTimeRange).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(COMPARISON_LABEL)).not.toBeInTheDocument();
});

test('inherit shift shifts back by the length of the current range', async () => {
  renderLabel({ time_compare: ['inherit'] });

  expect(await screen.findByText(COMPARISON_LABEL)).toBeInTheDocument();
  expect(mockedFetchTimeRange).toHaveBeenNthCalledWith(
    1,
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
  );
  expect(mockedFetchTimeRange).toHaveBeenNthCalledWith(
    2,
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
    ['30 days ago'],
  );
});

test('legacy "r" shorthand behaves like an inherit shift', async () => {
  renderLabel({ time_comparison: 'r' });

  expect(await screen.findByText(COMPARISON_LABEL)).toBeInTheDocument();
  expect(mockedFetchTimeRange).toHaveBeenNthCalledWith(
    2,
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
    ['30 days ago'],
  );
});

test('inherit is combined with regular shifts in one comparison request', async () => {
  renderLabel({ time_compare: ['inherit', '1 year ago'] });

  expect(await screen.findByText(COMPARISON_LABEL)).toBeInTheDocument();
  expect(mockedFetchTimeRange).toHaveBeenNthCalledWith(
    2,
    temporalRangeFilter.comparator,
    temporalRangeFilter.subject,
    ['30 days ago', '1 year ago'],
  );
});
