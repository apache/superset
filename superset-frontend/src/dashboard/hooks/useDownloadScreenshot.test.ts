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
import { renderHook, act } from '@testing-library/react';
import { SupersetClient } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { useToasts } from 'src/components/MessageToasts/withToasts';
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

jest.mock('@apache-superset/core/utils', () => ({
  logging: {
    error: jest.fn(),
  },
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => undefined),
}));

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: jest.fn(),
}));

jest.mock('src/utils/urlUtils', () => ({
  getDashboardUrlParams: jest.fn(() => []),
}));

const RETRY_INTERVAL = 3000;
const SCREENSHOT_STATE_LEASE_SECONDS = 360;
const SCREENSHOT_TASK_TIMEOUT_SECONDS = 2 * SCREENSHOT_STATE_LEASE_SECONDS;
const MAX_SCREENSHOT_WAIT = SCREENSHOT_TASK_TIMEOUT_SECONDS * 1000;
const DASHBOARD_ID = 123;
const CACHE_KEY = 'test-cache-key';
const PERMALINK_KEY = 'test-permalink-key';
const addDangerToast = jest.fn();
const addSuccessToast = jest.fn();
const addInfoToast = jest.fn();

const taskResponse = (
  taskStatus: 'Pending' | 'Computing' | 'Updated' | 'Error',
  taskTimeoutSeconds = SCREENSHOT_TASK_TIMEOUT_SECONDS,
) => ({
  json: {
    cache_key: CACHE_KEY,
    permalink_key: PERMALINK_KEY,
    task_status: taskStatus,
    task_timeout_seconds: taskTimeoutSeconds,
  },
});

const mockPostSuccess = () =>
  (SupersetClient.post as jest.Mock).mockResolvedValue(taskResponse('Pending'));

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
  (useToasts as jest.Mock).mockReturnValue({
    addDangerToast,
    addSuccessToast,
    addInfoToast,
  });
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

  expect(SupersetClient.post).toHaveBeenCalledTimes(2);
  const [[callArgs], [pollArgs]] = (SupersetClient.post as jest.Mock).mock
    .calls;

  // Verify that force=true is included in the endpoint URL
  // This prevents regression where stale cached screenshots are returned
  expect(callArgs.endpoint).toContain('force');
  expect(callArgs.endpoint).toMatch(/force[:%]true|force[:%]!t/);

  expect(pollArgs.endpoint).not.toContain('force');
  expect(pollArgs.jsonPayload).toEqual({ permalinkKey: PERMALINK_KEY });
});

test('does not issue overlapping status polls', async () => {
  jest.useFakeTimers();
  (SupersetClient.post as jest.Mock)
    .mockResolvedValueOnce(taskResponse('Pending'))
    .mockImplementation(() => new Promise(() => {}));

  await triggerDownload();

  // Initial trigger plus one immediate status poll.
  expect(SupersetClient.post).toHaveBeenCalledTimes(2);

  // Advance past several retry intervals while the first poll is still pending.
  await act(async () => {
    jest.advanceTimersByTime(RETRY_INTERVAL * 5);
    await flushPromises();
  });

  // isFetching guard must prevent the interval from stacking new requests.
  expect(SupersetClient.post).toHaveBeenCalledTimes(2);

  await act(async () => {
    jest.advanceTimersByTime(MAX_SCREENSHOT_WAIT - RETRY_INTERVAL * 5);
    await flushPromises();
  });
  expect(logging.error).toHaveBeenCalledWith(
    'Screenshot generation timed out',
    expect.objectContaining({ permalinkKey: PERMALINK_KEY }),
  );

  jest.clearAllTimers();
  jest.useRealTimers();
});

test('times out when the initial request never settles', async () => {
  jest.useFakeTimers();
  (SupersetClient.post as jest.Mock).mockImplementation(
    () => new Promise(() => {}),
  );

  await triggerDownload();

  await act(async () => {
    jest.advanceTimersByTime(MAX_SCREENSHOT_WAIT);
    await flushPromises();
  });

  expect(logging.error).toHaveBeenCalledWith(
    'Screenshot generation timed out',
    {
      permalinkKey: undefined,
      dashboardId: DASHBOARD_ID,
      format: DownloadScreenshotFormat.PNG,
    },
  );
  expect(SupersetClient.post).toHaveBeenCalledTimes(1);

  jest.clearAllTimers();
  jest.useRealTimers();
});

test('ignores an initial response that settles after the operation timed out', async () => {
  jest.useFakeTimers();
  let resolveTrigger: (
    response: ReturnType<typeof taskResponse>,
  ) => void = () => {};
  (SupersetClient.post as jest.Mock).mockReturnValue(
    new Promise<ReturnType<typeof taskResponse>>(resolve => {
      resolveTrigger = resolve;
    }),
  );

  await triggerDownload();

  // A trigger without a server response retains the shorter default guard.
  await act(async () => {
    jest.advanceTimersByTime(SCREENSHOT_STATE_LEASE_SECONDS * 1000);
    await flushPromises();
  });
  expect(logging.error).toHaveBeenCalledWith(
    'Screenshot generation timed out',
    expect.objectContaining({ permalinkKey: undefined }),
  );

  await act(async () => {
    resolveTrigger(taskResponse('Updated'));
    await flushPromises();
  });

  expect(SupersetClient.get).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);

  jest.clearAllTimers();
  jest.useRealTimers();
});

test('times out when the artifact download never settles', async () => {
  jest.useFakeTimers();
  (SupersetClient.post as jest.Mock).mockResolvedValue(taskResponse('Updated'));

  await triggerDownload();
  expect(SupersetClient.get).toHaveBeenCalledTimes(1);

  await act(async () => {
    jest.advanceTimersByTime(MAX_SCREENSHOT_WAIT);
    await flushPromises();
  });

  expect(logging.error).toHaveBeenCalledWith(
    'Screenshot generation timed out',
    expect.objectContaining({ permalinkKey: PERMALINK_KEY }),
  );
  expect(SupersetClient.get).toHaveBeenCalledTimes(1);

  jest.clearAllTimers();
  jest.useRealTimers();
});

test('reports failure when the browser cannot create the download URL', async () => {
  (SupersetClient.post as jest.Mock).mockResolvedValue(taskResponse('Updated'));
  (SupersetClient.get as jest.Mock).mockResolvedValue(createResponse());
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  Object.assign(window.URL, {
    createObjectURL: jest.fn(() => {
      throw new Error('object URLs unavailable');
    }),
    revokeObjectURL: jest.fn(),
  });

  await triggerDownload();

  expect(addSuccessToast).not.toHaveBeenCalled();
  expect(addDangerToast).toHaveBeenCalledTimes(1);
  expect(logging.error).toHaveBeenCalledWith(
    'Failed to download screenshot artifact',
    expect.objectContaining({ cacheKey: CACHE_KEY }),
  );
  Object.assign(window.URL, {
    createObjectURL: originalCreateObjectURL,
    revokeObjectURL: originalRevokeObjectURL,
  });
});

test('keeps independent deadlines for concurrent downloads', async () => {
  jest.useFakeTimers();
  let resolveFirstPoll: (
    response: ReturnType<typeof taskResponse>,
  ) => void = () => {};
  const firstPoll = new Promise<ReturnType<typeof taskResponse>>(resolve => {
    resolveFirstPoll = resolve;
  });
  (SupersetClient.post as jest.Mock)
    .mockResolvedValueOnce(taskResponse('Pending'))
    .mockReturnValueOnce(firstPoll)
    .mockResolvedValueOnce(taskResponse('Pending'))
    .mockImplementationOnce(() => new Promise(() => {}));
  (SupersetClient.get as jest.Mock).mockResolvedValue(createResponse());
  Object.assign(window.URL, {
    createObjectURL: jest.fn(() => 'blob:mock'),
    revokeObjectURL: jest.fn(),
  });
  const clickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const { result } = renderHook(() => useDownloadScreenshot(DASHBOARD_ID));

  await act(async () => {
    result.current(DownloadScreenshotFormat.PNG);
    await flushPromises();
  });
  await act(async () => {
    result.current(DownloadScreenshotFormat.PDF);
    await flushPromises();
  });
  expect(SupersetClient.post).toHaveBeenCalledTimes(4);

  await act(async () => {
    resolveFirstPoll(taskResponse('Updated'));
    await flushPromises();
  });
  expect(clickSpy).toHaveBeenCalledTimes(1);

  await act(async () => {
    jest.advanceTimersByTime(MAX_SCREENSHOT_WAIT);
    await flushPromises();
  });
  expect(logging.error).toHaveBeenCalledWith(
    'Screenshot generation timed out',
    expect.objectContaining({ format: DownloadScreenshotFormat.PDF }),
  );

  clickSpy.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('triggers only one download when multiple successful responses race', async () => {
  jest.useFakeTimers();
  (SupersetClient.post as jest.Mock)
    .mockResolvedValueOnce(taskResponse('Pending'))
    .mockResolvedValue(taskResponse('Updated'));
  (SupersetClient.get as jest.Mock).mockResolvedValue(createResponse());

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

test('keeps polling beyond the previous retry ceiling and downloads', async () => {
  jest.useFakeTimers();
  let postCalls = 0;
  (SupersetClient.post as jest.Mock).mockImplementation(() => {
    postCalls += 1;
    return Promise.resolve(
      taskResponse(postCalls >= 36 ? 'Updated' : 'Computing'),
    );
  });
  (SupersetClient.get as jest.Mock).mockResolvedValue(createResponse());
  Object.assign(window.URL, {
    createObjectURL: jest.fn(() => 'blob:mock'),
    revokeObjectURL: jest.fn(),
  });
  const clickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});

  await triggerDownload();

  // The trigger plus immediate poll account for two calls. Thirty-four more
  // intervals put completion beyond the old 96-second wall-clock cutoff.
  for (let i = 0; i < 34; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(RETRY_INTERVAL);
      await flushPromises();
    });
  }

  expect(clickSpy).toHaveBeenCalledTimes(1);
  expect(logging.error).not.toHaveBeenCalled();

  clickSpy.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('waits through the Pending lease when a worker starts near its end', async () => {
  jest.useFakeTimers();
  let resolvePoll: (
    response: ReturnType<typeof taskResponse>,
  ) => void = () => {};
  const pendingPoll = new Promise<ReturnType<typeof taskResponse>>(resolve => {
    resolvePoll = resolve;
  });
  (SupersetClient.post as jest.Mock)
    .mockResolvedValueOnce(taskResponse('Pending'))
    .mockReturnValueOnce(pendingPoll)
    .mockImplementation(() => new Promise(() => {}));

  await triggerDownload();

  await act(async () => {
    jest.advanceTimersByTime(
      SCREENSHOT_STATE_LEASE_SECONDS * 1000 - RETRY_INTERVAL,
    );
    resolvePoll(taskResponse('Computing'));
    await flushPromises();
  });
  await act(async () => {
    jest.advanceTimersByTime(RETRY_INTERVAL * 2);
    await flushPromises();
  });

  // A one-lease client deadline would have fired as Computing began. The
  // advertised whole-task budget reserves a second lease for worker runtime.
  expect(logging.error).not.toHaveBeenCalled();

  jest.clearAllTimers();
  jest.useRealTimers();
});

test('uses the task timeout advertised by the server', async () => {
  jest.useFakeTimers();
  const advertisedTimeoutSeconds = 900;
  (SupersetClient.post as jest.Mock).mockResolvedValue(
    taskResponse('Computing', advertisedTimeoutSeconds),
  );

  await triggerDownload();

  await act(async () => {
    jest.advanceTimersByTime(MAX_SCREENSHOT_WAIT);
    await flushPromises();
  });
  expect(logging.error).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(
      advertisedTimeoutSeconds * 1000 - MAX_SCREENSHOT_WAIT,
    );
    await flushPromises();
  });
  expect(logging.error).toHaveBeenCalledWith(
    'Screenshot generation timed out',
    expect.objectContaining({ permalinkKey: PERMALINK_KEY }),
  );

  jest.clearAllTimers();
  jest.useRealTimers();
});

test('stops polling immediately when screenshot generation reaches Error', async () => {
  jest.useFakeTimers();
  (SupersetClient.post as jest.Mock)
    .mockResolvedValueOnce(taskResponse('Pending'))
    .mockResolvedValueOnce(taskResponse('Error'));

  await triggerDownload();

  expect(logging.error).toHaveBeenCalledWith('Screenshot generation failed', {
    cacheKey: CACHE_KEY,
    dashboardId: DASHBOARD_ID,
    format: DownloadScreenshotFormat.PNG,
  });
  expect(SupersetClient.get).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(RETRY_INTERVAL * 5);
    await flushPromises();
  });
  expect(SupersetClient.post).toHaveBeenCalledTimes(2);

  jest.clearAllTimers();
  jest.useRealTimers();
});

test('recovers when an Updated image is evicted before GET', async () => {
  jest.useFakeTimers();
  (SupersetClient.post as jest.Mock)
    .mockResolvedValueOnce(taskResponse('Pending'))
    .mockResolvedValueOnce(taskResponse('Updated'))
    .mockResolvedValueOnce(taskResponse('Pending'))
    .mockResolvedValue(taskResponse('Updated'));
  (SupersetClient.get as jest.Mock)
    .mockRejectedValueOnce(notReadyError())
    .mockResolvedValueOnce(createResponse());

  Object.assign(window.URL, {
    createObjectURL: jest.fn(() => 'blob:mock'),
    revokeObjectURL: jest.fn(),
  });
  const clickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});

  await triggerDownload();
  for (let i = 0; i < 2; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(RETRY_INTERVAL);
      await flushPromises();
    });
  }

  expect(clickSpy).toHaveBeenCalledTimes(1);
  expect(SupersetClient.get).toHaveBeenCalledTimes(2);

  clickSpy.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('logs dashboardId, format, and the error when the initial screenshot request fails', async () => {
  const error = new Error('network down');
  (SupersetClient.post as jest.Mock).mockRejectedValue(error);

  const { result } = renderHook(() => useDownloadScreenshot(DASHBOARD_ID));
  await act(async () => {
    result.current(DownloadScreenshotFormat.PDF);
    await flushPromises();
  });

  expect(logging.error).toHaveBeenCalledWith(
    'Failed to trigger dashboard screenshot',
    { dashboardId: DASHBOARD_ID, format: DownloadScreenshotFormat.PDF, error },
  );
});
