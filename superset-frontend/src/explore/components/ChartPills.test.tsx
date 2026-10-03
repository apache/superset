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
import { QueryData, VizType } from '@superset-ui/core';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { ChartPills, ChartPillsProps } from './ChartPills';

const ROW_LIMIT = 10000;

const renderPills = (props: Partial<ChartPillsProps> = {}) => {
  const refreshCachedQuery = jest.fn();
  render(
    <ChartPills
      chartStatus="success"
      chartUpdateStartTime={0}
      rowLimit={ROW_LIMIT}
      refreshCachedQuery={refreshCachedQuery}
      {...props}
    />,
  );
  return { refreshCachedQuery };
};

// Table viz types report their total row count in a second query response.
const paginatedTableResponses = (
  pageRowCount: number,
  totalRowCount: number,
): QueryData[] => [
  { rowcount: pageRowCount, data: [] },
  { data: [{ rowcount: totalRowCount }] },
];

const cachedResponse = (): QueryData => ({
  rowcount: 25,
  is_cached: true,
  cached_dttm: '2024-01-01T00:00:00',
  data: [],
});

test.each([VizType.Table, VizType.TableAgGrid])(
  'reads the row count of a %s from the second query',
  vizType => {
    renderPills({
      queriesResponse: paginatedTableResponses(25, 250),
      formData: { viz_type: vizType },
    });

    expect(screen.getByText('250 rows')).toBeInTheDocument();
    expect(screen.queryByText('25 rows')).not.toBeInTheDocument();
  },
);

test('reads the row count from the first query for a table with a single query', () => {
  renderPills({
    queriesResponse: [{ rowcount: 25, data: [] }],
    formData: { viz_type: VizType.Table },
  });

  expect(screen.getByText('25 rows')).toBeInTheDocument();
});

test('reads the row count from the first query for non-table charts even with a second query', () => {
  renderPills({
    queriesResponse: paginatedTableResponses(25, 250),
    formData: { viz_type: VizType.Histogram },
  });

  expect(screen.getByText('25 rows')).toBeInTheDocument();
  expect(screen.queryByText('250 rows')).not.toBeInTheDocument();
});

test('prefers sql_rowcount over rowcount', () => {
  renderPills({
    queriesResponse: [{ sql_rowcount: 40, rowcount: 7, data: [] }],
    formData: { viz_type: VizType.Histogram },
  });

  expect(screen.getByText('40 rows')).toBeInTheDocument();
  expect(screen.queryByText('7 rows')).not.toBeInTheDocument();
});

test('falls back to rowcount when sql_rowcount is absent', () => {
  renderPills({
    queriesResponse: [{ rowcount: 7, data: [] }],
    formData: { viz_type: VizType.Histogram },
  });

  expect(screen.getByText('7 rows')).toBeInTheDocument();
});

test('hides the row count but keeps the timer when hideRowCount is set', () => {
  renderPills({
    queriesResponse: [{ rowcount: 25, data: [] }],
    hideRowCount: true,
  });

  expect(screen.queryByText('25 rows')).not.toBeInTheDocument();
  expect(screen.getByRole('timer')).toBeInTheDocument();
});

test('does not show the row count without a query response', () => {
  renderPills({ queriesResponse: [] });

  expect(screen.queryByText(/rows?$/)).not.toBeInTheDocument();
});

test('shows the cached label for a cached response and refreshes on click', async () => {
  const { refreshCachedQuery } = renderPills({
    queriesResponse: [cachedResponse()],
  });

  expect(refreshCachedQuery).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText('Cached'));

  expect(refreshCachedQuery).toHaveBeenCalledTimes(1);
});

test('does not show the cached label for an uncached response', () => {
  renderPills({ queriesResponse: [{ rowcount: 25, data: [] }] });

  expect(screen.queryByText('Cached')).not.toBeInTheDocument();
});

test('shows neither the row count nor the cached label while loading', () => {
  renderPills({
    chartStatus: 'loading',
    queriesResponse: [cachedResponse()],
  });

  expect(screen.queryByText('25 rows')).not.toBeInTheDocument();
  expect(screen.queryByText('Cached')).not.toBeInTheDocument();
  expect(screen.getByRole('timer')).toBeInTheDocument();
});

test('shows the elapsed time between the update start and end', () => {
  renderPills({
    chartUpdateStartTime: 1000,
    chartUpdateEndTime: 3500,
    queriesResponse: [{ rowcount: 25, data: [] }],
  });

  expect(screen.getByRole('timer')).toHaveTextContent(/^00:00:02\.500$/);
});
