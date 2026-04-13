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
import { renderHook, act } from '@testing-library/react-hooks';
import { SupersetClient } from '@superset-ui/core';
import { useDownloadScreenshot } from './useDownloadScreenshot';
import { DownloadScreenshotFormat } from '../components/menu/DownloadMenuItems/types';

jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
  SupersetApiError: class SupersetApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  logging: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  t: (s: string) => s,
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => undefined),
}));

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
    addInfoToast: jest.fn(),
  }),
}));

jest.mock('src/utils/urlUtils', () => ({
  getDashboardUrlParams: jest.fn(() => []),
}));

test('downloadScreenshot calls API with force=true to ensure fresh screenshots', async () => {
  const mockCacheKey = 'test-cache-key';
  (SupersetClient.post as jest.Mock).mockResolvedValue({
    json: { cache_key: mockCacheKey },
  });

  const { result } = renderHook(() => useDownloadScreenshot(123));

  await act(async () => {
    result.current(DownloadScreenshotFormat.PNG);
  });

  expect(SupersetClient.post).toHaveBeenCalledTimes(1);
  const callArgs = (SupersetClient.post as jest.Mock).mock.calls[0][0];

  // Verify that force=true is included in the endpoint URL
  // This prevents regression where stale cached screenshots are returned
  expect(callArgs.endpoint).toContain('force');
  expect(callArgs.endpoint).toMatch(/force[:%]true|force[:%]!t/);
});
