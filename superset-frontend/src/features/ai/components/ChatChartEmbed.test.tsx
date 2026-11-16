/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { JsonResponse, StatefulChart, SupersetClient } from '@superset-ui/core';
import { act, render, screen } from 'spec/helpers/testing-library';
import { ChatChartEmbedInner } from './ChatChartEmbed';

jest.mock('@superset-ui/core', () => ({
  __esModule: true,
  ...jest.requireActual('@superset-ui/core'),
  StatefulChart: jest.fn(() => <div data-test="embedded-chart" />),
}));
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  ...jest.requireActual('src/utils/getBootstrapData'),
  applicationRoot: () => '/analytics',
}));

const response: JsonResponse = {
  response: new Response(),
  json: {
    form_data: JSON.stringify({ viz_type: 'table', datasource: '1__table' }),
  },
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(StatefulChart).mockClear();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('Explore links retain the application root', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue(response);
  render(<ChatChartEmbedInner formDataKey="preview" />);
  await act(async () => {});
  expect(screen.getByRole('link', { name: /Open in Explore/ })).toHaveAttribute(
    'href',
    '/analytics/explore/?form_data_key=preview',
  );
});

test('an empty successful chart does not poll or remount', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue(response);
  render(<ChatChartEmbedInner formDataKey="preview" />);
  await act(async () => {});
  const chart = screen.getByTestId('embedded-chart');
  const props = jest.mocked(StatefulChart).mock.calls.at(-1)![0];
  act(() =>
    props.onLoad?.([{ data: [] }] as Parameters<
      NonNullable<typeof props.onLoad>
    >[0]),
  );
  act(() => jest.advanceTimersByTime(60_000));
  expect(screen.getByTestId('embedded-chart')).toBe(chart);
  expect(screen.queryByText('Loading chart data...')).not.toBeInTheDocument();
});

test('unmount cancels a pending configuration retry', async () => {
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(new Error('retry'));
  const { unmount } = render(<ChatChartEmbedInner formDataKey="preview" />);
  await act(async () => {});
  expect(get).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => jest.advanceTimersByTime(500));
  expect(get).toHaveBeenCalledTimes(1);
});

test('changing keys aborts the old request and ignores its late response', async () => {
  let resolveOld!: (value: typeof response) => void;
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockReturnValueOnce(
      new Promise(resolve => {
        resolveOld = resolve;
      }),
    )
    .mockResolvedValue(response);
  const { rerender, unmount } = render(
    <ChatChartEmbedInner formDataKey="old" />,
  );
  const { signal } = get.mock.calls[0][0];
  rerender(<ChatChartEmbedInner formDataKey="new" />);
  await act(async () => {});
  expect(signal?.aborted).toBe(true);
  await act(async () => resolveOld({ ...response, json: { form_data: '' } }));
  expect(screen.getByTestId('embedded-chart')).toBeInTheDocument();
  await act(async () => jest.advanceTimersByTime(60_000));
  expect(get).toHaveBeenCalledTimes(2);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
