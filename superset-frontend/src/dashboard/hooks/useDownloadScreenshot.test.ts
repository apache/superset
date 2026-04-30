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

const RETRY_INTERVAL = 3000;
const DASHBOARD_ID = 123;
const CACHE_KEY = 'test-cache-key';

const mockPostSuccess = () =>
  (SupersetClient.post as jest.Mock).mockResolvedValue({
    json: { cache_key: CACHE_KEY },
  });

const createResponse = (): Response =>
  ({
    headers: { get: () => null },
    blob: () => Promise.resolve(new Blob(['image-data'])),
  }) as unknown as Response;

const notReadyError = () => ({ status: 404 });

// Chain several Promise.resolves to drain nested microtasks (.then/.catch/.finally
// in the hook). setImmediate-based flush would stall under fake timers.
const flushPromises = async () => {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const triggerDownload = async () => {
  const { result } = renderHook(() => useDownloadScreenshot(DASHBOARD_ID));
  await act(async () => {
    result.current(DownloadScreenshotFormat.PNG);
    await flushPromises();
  });
  return result;
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: GET hangs so microtask chains don't throw on undefined in tests
  // that only care about POST behavior.
  (SupersetClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));
});

test('downloadScreenshot calls API with force=true to ensure fresh screenshots', async () => {
  mockPostSuccess();

  const { result } = renderHook(() => useDownloadScreenshot(DASHBOARD_ID));

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

test('does not issue overlapping GETs while a previous GET is in-flight', async () => {
  jest.useFakeTimers();
  mockPostSuccess();

  // GET never resolves within the test — simulates a slow screenshot request.
  (SupersetClient.get as jest.Mock).mockImplementation(
    () => new Promise(() => {}),
  );

  await triggerDownload();

  // First (immediate) GET fires right after POST resolves.
  expect(SupersetClient.get).toHaveBeenCalledTimes(1);

  // Advance past several retry intervals while the first GET is still pending.
  await act(async () => {
    jest.advanceTimersByTime(RETRY_INTERVAL * 5);
    await flushPromises();
  });

  // isFetching guard must prevent the interval from stacking new requests.
  expect(SupersetClient.get).toHaveBeenCalledTimes(1);

  jest.clearAllTimers();
  jest.useRealTimers();
});

test('triggers only one download when multiple successful responses race', async () => {
  jest.useFakeTimers();
  mockPostSuccess();

  // First GET returns 404 (not ready), then resolves 200 for every subsequent call.
  // Without the isDownloaded guard any late-arriving 200 would trigger a second click.
  (SupersetClient.get as jest.Mock)
    .mockRejectedValueOnce(notReadyError())
    .mockResolvedValue(createResponse());

  // jsdom does not implement URL.createObjectURL / revokeObjectURL — stub them.
  Object.assign(window.URL, {
    createObjectURL: jest.fn(() => 'blob:mock'),
    revokeObjectURL: jest.fn(),
  });
  const clickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});

  await triggerDownload();

  // Drive several interval ticks so multiple 200 responses could resolve.
  await act(async () => {
    jest.advanceTimersByTime(RETRY_INTERVAL * 5);
    await flushPromises();
  });

  expect(clickSpy).toHaveBeenCalledTimes(1);

  clickSpy.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});
