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

import { act, renderHook } from '@testing-library/react';
import * as exploreUtils from 'src/explore/exploreUtils';
import { useExploreDataExport } from './useExploreDataExport';

const mockAddDangerToast = jest.fn();
const mockAddSuccessToast = jest.fn();
const mockStartExport = jest.fn();
const mockResetExport = jest.fn();
const mockRetryExport = jest.fn();

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
    addSuccessToast: mockAddSuccessToast,
  }),
}));

jest.mock('src/components/StreamingExportModal', () => ({
  useStreamingExport: jest.fn(() => ({
    progress: {
      rowsProcessed: 0,
      totalRows: undefined,
      totalSize: 0,
      speed: 0,
      mbPerSecond: 0,
      elapsedTime: 0,
      status: 'streaming',
    },
    startExport: mockStartExport,
    resetExport: mockResetExport,
    retryExport: mockRetryExport,
  })),
}));

jest.mock('src/explore/exploreUtils', () => ({
  __esModule: true,
  ...jest.requireActual('src/explore/exploreUtils'),
  exportChart: jest.fn(),
  getChartKey: jest.fn(() => 1),
}));

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(callback =>
    callback({
      charts: {
        1: {
          queriesResponse: [{ sql_rowcount: 10 }],
        },
      },
      explore: {
        slice: {
          slice_id: 1,
          slice_name: 'Test Chart',
        },
      },
      common: {
        conf: {
          CSV_STREAMING_ROW_THRESHOLD: 1000,
        },
      },
    }),
  ),
}));

const mockExportChart = exploreUtils.exportChart as jest.Mock;

const defaultProps = {
  latestQueryFormData: {
    datasource: '1__table',
    viz_type: 'table',
    row_limit: 10000,
  } as any,
  canDownloadCSV: true,
  slice: {
    slice_id: 1,
    slice_name: 'Test Chart',
  } as any,
  ownState: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  mockExportChart.mockResolvedValue(undefined);
});

test('exports CSV with full result type', async () => {
  const { result } = renderHook(() => useExploreDataExport(defaultProps));

  await act(async () => {
    await result.current.exportCSV();
  });

  expect(mockExportChart).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: defaultProps.latestQueryFormData,
      ownState: defaultProps.ownState,
      resultType: 'full',
      resultFormat: 'csv',
    }),
  );
});

test('exports pivoted CSV with post processed result type', async () => {
  const { result } = renderHook(() => useExploreDataExport(defaultProps));

  await act(async () => {
    await result.current.exportCSVPivoted();
  });

  expect(mockExportChart).toHaveBeenCalledWith({
    formData: defaultProps.latestQueryFormData,
    ownState: defaultProps.ownState,
    resultType: 'post_processed',
    resultFormat: 'csv',
  });
});

test('exports JSON with results result type', async () => {
  const { result } = renderHook(() => useExploreDataExport(defaultProps));

  await act(async () => {
    await result.current.exportJson();
  });

  expect(mockExportChart).toHaveBeenCalledWith({
    formData: defaultProps.latestQueryFormData,
    ownState: defaultProps.ownState,
    resultType: 'results',
    resultFormat: 'json',
  });
});

test('exports Excel with results result type', async () => {
  const { result } = renderHook(() => useExploreDataExport(defaultProps));

  await act(async () => {
    await result.current.exportExcel();
  });

  expect(mockExportChart).toHaveBeenCalledWith({
    formData: defaultProps.latestQueryFormData,
    ownState: defaultProps.ownState,
    resultType: 'results',
    resultFormat: 'xlsx',
  });
});

test('does not export when downloads are disabled', async () => {
  const { result } = renderHook(() =>
    useExploreDataExport({
      ...defaultProps,
      canDownloadCSV: false,
    }),
  );

  await act(async () => {
    await result.current.exportCSV();
    await result.current.exportCSVPivoted();
    await result.current.exportJson();
    await result.current.exportExcel();
  });

  expect(mockExportChart).not.toHaveBeenCalled();
});

test('shows large data error toast when export fails with status 413', async () => {
  mockExportChart.mockRejectedValue({
    status: 413,
  });

  const { result } = renderHook(() => useExploreDataExport(defaultProps));

  await act(async () => {
    await result.current.exportCSV();
  });

  expect(mockAddDangerToast).toHaveBeenCalledWith(
    expect.stringContaining('too large to download'),
  );
});

test('shows export error message when export fails', async () => {
  mockExportChart.mockRejectedValue(new Error('Export exploded'));

  const { result } = renderHook(() => useExploreDataExport(defaultProps));

  await act(async () => {
    await result.current.exportJson();
  });

  expect(mockAddDangerToast).toHaveBeenCalledWith('Export exploded');
});

test('exposes streaming export modal state and handlers', () => {
  const { result } = renderHook(() => useExploreDataExport(defaultProps));

  expect(result.current.streamingExportState).toEqual(
    expect.objectContaining({
      isVisible: false,
      onRetry: mockRetryExport,
    }),
  );
});
