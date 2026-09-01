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
import fetchMock from 'fetch-mock';
import { Constants } from '@superset-ui/core/components';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  cleanupAsyncOperations,
  createProps,
  DATASOURCE_ENDPOINT,
  dismissDatasourceWarning,
  fastRender,
  setupDatasourceEditorMocks,
} from './DatasourceEditor.test.utils';

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  jest.useRealTimers();
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
});

test('a trailing Basic edit keeps pending Certification fields', async () => {
  const testProps = createProps();
  const extra = '{ "custom_key": true }';
  testProps.datasource.extra = extra;
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

  const defaultUrlLabel = await screen.findByText('Default URL');
  const defaultUrl = defaultUrlLabel
    .closest('.ant-form-item')
    ?.querySelector('input');
  expect(defaultUrl).not.toBeNull();
  const certifiedBy = await screen.findByPlaceholderText('Certified by');
  const certificationDetails = screen.getByPlaceholderText(
    'Certification details',
  );

  jest.useFakeTimers();
  fireEvent.change(certifiedBy, {
    target: { value: 'Data Team' },
  });
  fireEvent.change(certificationDetails, {
    target: { value: 'Reviewed for production' },
  });
  fireEvent.change(defaultUrl as HTMLInputElement, {
    target: { value: '/dashboard/7/' },
  });
  act(() => {
    jest.advanceTimersByTime(Constants.FAST_DEBOUNCE);
  });
  jest.useRealTimers();

  await waitFor(() => {
    const { calls } = testProps.onChange.mock;
    expect(calls[calls.length - 1]?.[0]).toEqual(
      expect.objectContaining({
        default_endpoint: '/dashboard/7/',
        certified_by: 'Data Team',
        certification_details: 'Reviewed for production',
        dataset_certification_changed: true,
        extra,
      }),
    );
  });
});

test('malformed Extra disables dataset certification controls', async () => {
  const testProps = createProps();
  testProps.datasource.extra = '{"custom_key":';
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

  expect(await screen.findByPlaceholderText('Certified by')).toBeDisabled();
  expect(screen.getByPlaceholderText('Certification details')).toBeDisabled();
  expect(
    screen.getAllByText('Fix the Extra JSON to edit certification'),
  ).toHaveLength(2);
});
