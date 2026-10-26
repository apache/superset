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

import { StatefulChart, SupersetClient } from '@superset-ui/core';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { exploreChart } from 'src/explore/exploreUtils';
import {
  isChartAuthoringDisplay,
  parseToolCall,
  parseToolDisplay,
} from '../types';
import { ChatChartEmbedInner } from './ChatChartEmbed';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  StatefulChart: jest.fn(() => <div data-test="native-preview" />),
}));
jest.mock('src/explore/exploreUtils', () => ({
  ...jest.requireActual('src/explore/exploreUtils'),
  exploreChart: jest.fn(),
}));

const formData = {
  datasource: '1__table',
  viz_type: 'big_number_total',
  metric: 'sum__amount',
  adhoc_filters: [{ expressionType: 'SQL', sqlExpression: 'amount > 0' }],
};
const display = {
  kind: 'chart_authoring',
  form_data_key: 'expired-key',
  form_data: formData,
};

beforeEach(() => jest.clearAllMocks());

test('retained tool configuration renders after the cache key expires and opens Explore', async () => {
  const stored = JSON.parse(
    JSON.stringify({ name: 'generate_chart', ok: true, display }),
  );
  const parsed = parseToolCall(stored)?.display;
  expect(isChartAuthoringDisplay(parsed)).toBe(true);
  if (!isChartAuthoringDisplay(parsed))
    throw new Error('Missing chart display');
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue({ status: 404 });
  const { unmount } = render(
    <ChatChartEmbedInner
      formDataKey="expired-key"
      savedFormData={parsed.formData}
    />,
  );
  await screen.findByTestId('native-preview');
  expect(get).not.toHaveBeenCalled();
  expect(StatefulChart).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: expect.objectContaining(formData),
    }),
    expect.anything(),
  );
  await userEvent.click(
    screen.getByRole('button', { name: /Open in Explore/ }),
  );
  expect(exploreChart).toHaveBeenCalledWith(formData);
  unmount();
  render(
    <ChatChartEmbedInner
      formDataKey="expired-key"
      savedFormData={parsed.formData}
    />,
  );
  await screen.findByTestId('native-preview');
  expect(get).not.toHaveBeenCalled();
});

test('legacy history still resolves its temporary key', async () => {
  jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue({ json: JSON.stringify(formData) });
  render(<ChatChartEmbedInner formDataKey="legacy-key" />);
  await screen.findByTestId('native-preview');
  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/explore/form_data/legacy-key',
    }),
  );
});

test.each([
  { ...display, _truncated: true },
  { ...display, form_data: { ...formData, _truncated: true } },
  { ...display, form_data: { viz_type: 'table' } },
  { ...display, form_data: { datasource: '1__table' } },
])('incomplete configuration is never replayed', value => {
  const parsed = parseToolDisplay(value);
  expect(isChartAuthoringDisplay(parsed) && parsed.formData).toBeUndefined();
});
