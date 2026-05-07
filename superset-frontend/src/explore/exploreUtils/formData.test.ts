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
import { SupersetClient } from '@superset-ui/core';
import { postFormData, putFormData } from './formData';

jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    post: jest.fn(),
    put: jest.fn(),
  },
}));

test('postFormData should call SupersetClient.post with correct payload and return key', async () => {
  const mockKey = '123abc';
  const mockResponse = { json: { key: mockKey } };

  (SupersetClient.post as jest.Mock).mockResolvedValue(mockResponse);

  const result = await postFormData(
    1,
    'table',
    { some: 'form', data: true },
    42,
    'tab-7',
  );

  expect(SupersetClient.post).toHaveBeenCalledWith({
    endpoint: 'api/v1/explore/form_data?tab_id=tab-7',
    jsonPayload: {
      datasource_id: 1,
      datasource_type: 'table',
      form_data: JSON.stringify({ some: 'form', data: true }), // assuming sanitizeFormData is a passthrough
      chart_id: 42,
    },
  });

  expect(result).toBe(mockKey);
});

test('putFormData should call SupersetClient.put with correct payload and return message', async () => {
  const mockMessage = 'Form data updated';
  const mockResponse = { json: { message: mockMessage } };

  (SupersetClient.put as jest.Mock).mockResolvedValue(mockResponse);

  const result = await putFormData(
    10,
    'druid',
    'abc123',
    { another: 'value' },
    undefined,
    'tab-5',
  );

  expect(SupersetClient.put).toHaveBeenCalledWith({
    endpoint: 'api/v1/explore/form_data/abc123?tab_id=tab-5',
    jsonPayload: {
      datasource_id: 10,
      datasource_type: 'druid',
      form_data: JSON.stringify({ another: 'value' }), // again, assuming sanitizeFormData is passthrough
    },
  });

  expect(result).toBe(mockMessage);
});

test('postFormData without optional params should work', async () => {
  (SupersetClient.post as jest.Mock).mockResolvedValue({
    json: { key: 'abc' },
  });

  await postFormData(2, 'table', { foo: 'bar' });

  expect(SupersetClient.post).toHaveBeenCalledWith({
    endpoint: 'api/v1/explore/form_data',
    jsonPayload: {
      datasource_id: 2,
      datasource_type: 'table',
      form_data: JSON.stringify({ foo: 'bar' }),
    },
  });
});
