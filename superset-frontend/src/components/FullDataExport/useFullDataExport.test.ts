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

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  isFullDataExportAvailable,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  useFullDataExport,
} from './useFullDataExport';

const mockAddDangerToast = jest.fn();
const mockAddInfoToast = jest.fn();
const mockAddSuccessToast = jest.fn();

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: (...args: unknown[]) => mockAddDangerToast(...args),
    addInfoToast: (...args: unknown[]) => mockAddInfoToast(...args),
    addSuccessToast: (...args: unknown[]) => mockAddSuccessToast(...args),
  }),
}));

const mockConf: Record<string, unknown> = {};
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({ common: { conf: mockConf } }),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

const { SupersetClient } = jest.requireMock('@superset-ui/core');

const ENDPOINT = '/api/v1/chart/data/full_export/';
const DOWNLOAD_URL = '/api/v1/data_export/download/job-1/';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockConf.FULL_DATA_EXPORT_AVAILABLE = true;
  SupersetClient.post.mockResolvedValue({ json: { job_id: 'job-1' } });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => {
  jest.useRealTimers();
});

/** Let the request settle, then advance to the next poll. */
async function advanceToNextPoll() {
  await act(async () => {
    await Promise.resolve();
    jest.advanceTimersByTime(POLL_INTERVAL_MS);
  });
}

test('an export is requested and the user is told it is coming by email', async () => {
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });

  expect(SupersetClient.post).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: ENDPOINT }),
  );
  expect(mockAddInfoToast).toHaveBeenCalledWith(
    expect.stringContaining('email with a download link'),
  );
});

test('the request is not retried, so a retry cannot lose the job id', async () => {
  // A retry would hit the first request's in-flight lock and be refused.
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });

  expect(SupersetClient.post).toHaveBeenCalledWith(
    expect.objectContaining({ fetchRetryOptions: { retries: 0 } }),
  );
});

test('a ready export downloads itself and reports its row count', async () => {
  SupersetClient.get.mockResolvedValue({
    json: { status: 'ready', download_url: DOWNLOAD_URL, row_count: 1250000 },
  });
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click');
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });
  await advanceToNextPoll();

  await waitFor(() =>
    expect(mockAddSuccessToast).toHaveBeenCalledWith(
      expect.stringContaining('1,250,000'),
    ),
  );
  // Confirmed with HEAD first: an error response would navigate the page
  // instead of downloading.
  expect(global.fetch).toHaveBeenCalledWith(
    DOWNLOAD_URL,
    expect.objectContaining({ method: 'HEAD' }),
  );
  await waitFor(() => expect(click).toHaveBeenCalled());
  click.mockRestore();
});

test('a dead download link is reported rather than navigated to', async () => {
  SupersetClient.get.mockResolvedValue({
    json: { status: 'ready', download_url: DOWNLOAD_URL },
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 410 });
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });
  await advanceToNextPoll();

  await waitFor(() =>
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      expect.stringContaining('link in the email'),
    ),
  );
});

test('a failed export shows the reason the worker recorded', async () => {
  SupersetClient.get.mockResolvedValue({
    json: { status: 'error', message: 'It took too long and was stopped.' },
  });
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });
  await advanceToNextPoll();

  await waitFor(() =>
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'It took too long and was stopped.',
    ),
  );
});

test('polling keeps waiting while the job is queued', async () => {
  SupersetClient.get.mockResolvedValue({ json: { status: 'pending' } });
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });
  await advanceToNextPoll();
  await advanceToNextPoll();

  await waitFor(() =>
    expect(SupersetClient.get.mock.calls.length).toBeGreaterThan(1),
  );
  expect(mockAddDangerToast).not.toHaveBeenCalled();
});

test('a long export stops being watched and is left to the email', async () => {
  // Not a failure: an uncapped export can run for far longer than anyone
  // wants to watch, and the email is how it was always going to arrive.
  SupersetClient.get.mockResolvedValue({ json: { status: 'running' } });
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });
  mockAddInfoToast.mockClear();
  await advanceToNextPoll();
  await act(async () => {
    await Promise.resolve();
    jest.advanceTimersByTime(POLL_TIMEOUT_MS + POLL_INTERVAL_MS);
  });
  await advanceToNextPoll();

  await waitFor(() =>
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      expect.stringContaining('still running'),
    ),
  );
  expect(mockAddDangerToast).not.toHaveBeenCalled();
});

test('a transient polling failure does not give up the wait', async () => {
  SupersetClient.get
    .mockRejectedValueOnce(new Error('network blip'))
    .mockResolvedValue({ json: { status: 'running' } });
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });
  await advanceToNextPoll();
  await advanceToNextPoll();

  await waitFor(() =>
    expect(SupersetClient.get.mock.calls.length).toBeGreaterThan(1),
  );
  expect(mockAddDangerToast).not.toHaveBeenCalled();
});

test('an actionable refusal is shown to the user', async () => {
  // The shape SupersetClient actually throws: the Response itself, which
  // getClientErrorObject reads the body and status from.
  SupersetClient.post.mockRejectedValue({
    response: new Response(
      JSON.stringify({
        message: 'A full export of this data is already in progress.',
      }),
      { status: 409 },
    ),
  });
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });

  await waitFor(() =>
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'A full export of this data is already in progress.',
    ),
  );
});

test('a server error stays generic', async () => {
  SupersetClient.post.mockRejectedValue({
    response: new Response(
      JSON.stringify({
        message: 'psycopg2.OperationalError: connection to secret-host failed',
      }),
      { status: 500 },
    ),
  });
  const { result } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });

  await waitFor(() =>
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    ),
  );
  expect(mockAddDangerToast).not.toHaveBeenCalledWith(
    expect.stringContaining('secret-host'),
  );
});

test('polling stops when the user navigates away', async () => {
  SupersetClient.get.mockResolvedValue({ json: { status: 'running' } });
  const { result, unmount } = renderHook(() => useFullDataExport());

  await act(async () => {
    await result.current.requestExport({ endpoint: ENDPOINT });
  });
  unmount();
  const callsAtUnmount = SupersetClient.get.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(POLL_INTERVAL_MS * 3);
  });

  expect(SupersetClient.get.mock.calls.length).toBe(callsAtUnmount);
});

test('the action is only available where the deployment can deliver one', () => {
  mockConf.FULL_DATA_EXPORT_AVAILABLE = true;
  expect(isFullDataExportAvailable()).toBe(true);

  mockConf.FULL_DATA_EXPORT_AVAILABLE = false;
  expect(isFullDataExportAvailable()).toBe(false);

  delete mockConf.FULL_DATA_EXPORT_AVAILABLE;
  expect(isFullDataExportAvailable()).toBe(false);
});
