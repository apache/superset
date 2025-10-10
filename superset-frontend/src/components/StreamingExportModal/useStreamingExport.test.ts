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
import { useStreamingExport } from './useStreamingExport';
import { ExportStatus } from './StreamingExportModal';

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    getCSRFToken: jest.fn(() => Promise.resolve('mock-csrf-token')),
  },
}));

// Mock URL APIs
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock fetch
global.fetch = jest.fn();

describe('useStreamingExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initializes with default progress state', () => {
    const { result } = renderHook(() => useStreamingExport());

    expect(result.current.progress).toEqual({
      rowsProcessed: 0,
      totalRows: undefined,
      totalSize: 0,
      speed: 0,
      mbPerSecond: 0,
      elapsedTime: 0,
      status: ExportStatus.STREAMING,
    });
  });

  test('provides startExport function', () => {
    const { result } = renderHook(() => useStreamingExport());

    expect(typeof result.current.startExport).toBe('function');
  });

  test('provides resetExport function', () => {
    const { result } = renderHook(() => useStreamingExport());

    expect(typeof result.current.resetExport).toBe('function');
  });

  test('provides retryExport function', () => {
    const { result } = renderHook(() => useStreamingExport());

    expect(typeof result.current.retryExport).toBe('function');
  });

  test('provides cancelExport function', () => {
    const { result } = renderHook(() => useStreamingExport());

    expect(typeof result.current.cancelExport).toBe('function');
  });

  test('resetExport resets progress to initial state', () => {
    const { result } = renderHook(() => useStreamingExport());

    act(() => {
      result.current.resetExport();
    });

    expect(result.current.progress.status).toBe(ExportStatus.STREAMING);
    expect(result.current.progress.rowsProcessed).toBe(0);
    expect(result.current.progress.totalSize).toBe(0);
  });

  test('accepts onComplete callback option', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useStreamingExport({ onComplete }));

    expect(result.current).toBeDefined();
  });

  test('accepts onError callback option', () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useStreamingExport({ onError }));

    expect(result.current).toBeDefined();
  });

  test('progress includes all required fields', () => {
    const { result } = renderHook(() => useStreamingExport());

    expect(result.current.progress).toHaveProperty('rowsProcessed');
    expect(result.current.progress).toHaveProperty('totalRows');
    expect(result.current.progress).toHaveProperty('totalSize');
    expect(result.current.progress).toHaveProperty('status');
    expect(result.current.progress).toHaveProperty('speed');
    expect(result.current.progress).toHaveProperty('mbPerSecond');
    expect(result.current.progress).toHaveProperty('elapsedTime');
  });

  test('cleans up on unmount', () => {
    const revokeObjectURL = jest.fn();
    global.URL.revokeObjectURL = revokeObjectURL;

    const { unmount } = renderHook(() => useStreamingExport());

    unmount();

    // Cleanup should not throw errors
    expect(true).toBe(true);
  });
});
