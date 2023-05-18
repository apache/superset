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

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}',
);
const flashUrl = bootstrapData?.common?.conf?.FLASH_URL;
const mockUrl = `${flashUrl}v1/flash/statuses`;

describe('FlashList', () => {
  afterEach(() => {
    fetchMock.restore();
  });

  it('Flash Status Api: Should fetch statuses from the api with status code 200', async () => {
    const mockResponse = [
      {
        id: 'InProgress',
        name: 'InProgress',
      },
      {
        id: 'Materialized_Failed',
        name: 'Materialized Failed',
      },
    ];

    fetchMock.get(mockUrl, mockResponse);

    const response = await fetch(mockUrl);
    const responseData = await response.json();
    expect(responseData).toBeDefined();
    expect(responseData.length).toBeGreaterThan(0);
  });

  it('Flash Status Api: Should handle 404 error with a proper error message', async () => {
    const mockErrorMessage = 'HTTP 404 Not Found';

    fetchMock.get(mockUrl, {
      code: 404,
      message: mockErrorMessage,
    });

    const response = await fetch(mockUrl);
    const responseData = await response.json();
    expect(responseData).toHaveProperty('message', mockErrorMessage);
    expect(responseData).toHaveProperty('code', 404);
  });
});
