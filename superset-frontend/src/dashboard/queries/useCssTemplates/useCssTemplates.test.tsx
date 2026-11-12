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
import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isFeatureEnabled } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import { useCssTemplates, cssTemplateKeys } from './useCssTemplates';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const CSS_TEMPLATE_ENDPOINT = 'glob:*/api/v1/css_template/?q=*';

const templates = [
  { template_name: 'Dark', css: 'body { color: white; }' },
  { template_name: 'Light', css: 'body { color: black; }' },
];

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(CSS_TEMPLATE_ENDPOINT, { body: { result: templates } });
});

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('cssTemplateKeys.all is the stable query key', () => {
  expect(cssTemplateKeys.all).toEqual(['cssTemplates']);
});

test('does not fetch when the CssTemplates feature flag is disabled', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(false);

  const { result } = renderHook(() => useCssTemplates(), { wrapper });

  await new Promise(f => {
    setTimeout(f, 50);
  });
  expect(fetchMock.callHistory.calls(CSS_TEMPLATE_ENDPOINT).length).toBe(0);
  expect(result.current.data).toBeUndefined();
});

test('fetches and returns css templates when the feature flag is enabled', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);

  const { result } = renderHook(() => useCssTemplates(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(templates);
});
