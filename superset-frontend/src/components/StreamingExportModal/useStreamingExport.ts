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
import { useState, useCallback, useRef, useEffect } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { ExportStatus, StreamingProgress } from './StreamingExportModal';

interface UseStreamingExportOptions {
  onComplete?: (downloadUrl: string, filename: string) => void;
  onError?: (error: string) => void;
}

interface StreamingExportPayload {
  [key: string]: any;
}

interface StreamingExportParams {
  url: string;
  payload: StreamingExportPayload;
  filename?: string;
  exportType: 'csv' | 'xlsx';
  expectedRows?: number;
}

const NEWLINE_BYTE = 10; // '\n' character code

const createFetchRequest = async (
  _url: string,
  payload: StreamingExportPayload,
  filename: string | undefined,
  _exportType: string,
  expectedRows: number | undefined,
  signal: AbortSignal,
): Promise<RequestInit> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Get CSRF token using SupersetClient
  const csrfToken = await SupersetClient.getCSRFToken();
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }

  const formParams: Record<string, string> = {};

  if (filename) {
    formParams.filename = filename;
  }

  if (expectedRows) {
    formParams.expected_rows = expectedRows.toString();
  }

  if ('client_id' in payload) {
    // SQL Lab export - pass client_id directly
    formParams.client_id = String(payload.client_id);
  } else {
    // Chart export - wrap payload in form_data
    formParams.form_data = JSON.stringify(payload);
  }

  return {
    method: 'POST',
    headers,
    body: new URLSearchParams(formParams),
    signal,
    credentials: 'same-origin',
  };
};

const countNewlines = (value: Uint8Array): number =>
  value.filter(byte => byte === NEWLINE_BYTE).length;

const createBlob = (
  chunks: Uint8Array[],
  receivedLength: number,
  exportType: string,
): Blob => {
  const completeData = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    completeData.set(chunk, position);
    position += chunk.length;
  }

  const mimeType =
    exportType === 'csv'
      ? 'text/csv;charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return new Blob([completeData], { type: mimeType });
};

export const useStreamingExport = (options: UseStreamingExportOptions = {}) => {
  const [progress, setProgress] = useState<StreamingProgress>({
    rowsProcessed: 0,
    totalRows: undefined,
    totalSize: 0,
    speed: 0,
    mbPerSecond: 0,
    elapsedTime: 0,
    status: ExportStatus.STREAMING,
  });
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastExportParamsRef = useRef<StreamingExportParams | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const isExportingRef = useRef(false);

  const updateProgress = useCallback((updates: Partial<StreamingProgress>) => {
    setProgress(prev => ({ ...prev, ...updates }));
  }, []);

  const executeExport = useCallback(
    async (params: StreamingExportParams) => {
      const { url, payload, filename, exportType, expectedRows } = params;
      if (isExportingRef.current) {
        return;
      }
      isExportingRef.current = true;

      abortControllerRef.current = new AbortController();

      updateProgress({
        rowsProcessed: 0,
        totalRows: expectedRows,
        totalSize: 0,
        speed: 0,
        mbPerSecond: 0,
        elapsedTime: 0,
        status: ExportStatus.STREAMING,
        filename,
      });

      try {
        const fetchOptions = await createFetchRequest(
          url,
          payload,
          filename,
          exportType,
          expectedRows,
          abortControllerRef.current.signal,
        );
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          throw new Error(
            `Export failed: ${response.status} ${response.statusText}`,
          );
        }

        if (!response.body) {
          throw new Error('Response body is not available for streaming');
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        const defaultFilename = `export.${exportType}`;
        let serverFilename = defaultFilename;

        if (contentDisposition) {
          const filenameMatch =
            contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch && filenameMatch[1]) {
            serverFilename = filenameMatch[1];
          }
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedLength = 0;
        let rowsProcessed = 0;
        let hasError = false;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          // eslint-disable-next-line no-await-in-loop
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Export cancelled by user');
          }

          // Check for error marker in the chunk
          const textDecoder = new TextDecoder();
          const chunkText = textDecoder.decode(value);

          if (chunkText.includes('__STREAM_ERROR__')) {
            const errorMatch = chunkText.match(/__STREAM_ERROR__:(.+)/);
            const errorMsg = errorMatch
              ? errorMatch[1].trim()
              : 'Export failed. Please try again.';

            // Update progress to show error with current progress preserved
            updateProgress({
              status: ExportStatus.ERROR,
              error: errorMsg,
              rowsProcessed,
              totalRows: expectedRows,
              totalSize: receivedLength,
            });

            isExportingRef.current = false;
            options.onError?.(errorMsg);
            hasError = true;
            break;
          }

          chunks.push(value);
          receivedLength += value.length;

          // Count newlines using filter (more efficient than loop)
          // Note: This counts all newlines, including those within quoted CSV fields.
          // For an exact row count, server should send row count in response headers.
          rowsProcessed += countNewlines(value);

          // Update progress based on rows processed
          updateProgress({
            status: ExportStatus.STREAMING,
            rowsProcessed,
            totalRows: expectedRows,
            totalSize: receivedLength,
            filename: serverFilename,
          });
        }

        // Check if we exited early due to error marker
        if (hasError) {
          return;
        }

        const blob = createBlob(chunks, receivedLength, exportType);

        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
        }

        const downloadUrl = URL.createObjectURL(blob);
        currentBlobUrlRef.current = downloadUrl;

        updateProgress({
          status: ExportStatus.COMPLETED,
          downloadUrl,
          filename: serverFilename,
        });

        isExportingRef.current = false;
        options.onComplete?.(downloadUrl, serverFilename);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';

        if (
          errorMessage.includes('cancelled') ||
          errorMessage.includes('aborted')
        ) {
          updateProgress({
            status: ExportStatus.CANCELLED,
          });
          isExportingRef.current = false;
        } else {
          updateProgress({
            status: ExportStatus.ERROR,
            error: errorMessage,
          });
          options.onError?.(errorMessage);
          isExportingRef.current = false;
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [updateProgress, options],
  );

  const startExport = useCallback(
    async (params: StreamingExportParams) => {
      if (isExportingRef.current) {
        return;
      }

      setRetryCount(0);
      lastExportParamsRef.current = params;

      updateProgress({
        rowsProcessed: 0,
        totalRows: params.expectedRows,
        totalSize: 0,
        speed: 0,
        mbPerSecond: 0,
        elapsedTime: 0,
        status: ExportStatus.STREAMING,
        filename: params.filename,
      });

      executeExport(params);
    },
    [updateProgress, executeExport],
  );

  const retryExport = useCallback(() => {
    if (!lastExportParamsRef.current) {
      return;
    }

    if (isExportingRef.current) {
      return;
    }

    setRetryCount(0);
    executeExport(lastExportParamsRef.current);
  }, [executeExport]);

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      updateProgress({
        status: ExportStatus.CANCELLED,
      });
    }
  }, [updateProgress]);

  const resetExport = useCallback(() => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }

    isExportingRef.current = false;
    abortControllerRef.current = null;
    setProgress({
      rowsProcessed: 0,
      totalRows: undefined,
      totalSize: 0,
      speed: 0,
      mbPerSecond: 0,
      elapsedTime: 0,
      status: ExportStatus.STREAMING,
    });
  }, []);

  // Cleanup blob URL on unmount to prevent memory leak
  useEffect(
    () => () => {
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
    },
    [],
  );

  return {
    progress,
    isExporting: isExportingRef.current,
    retryCount,
    startExport,
    cancelExport,
    resetExport,
    retryExport,
  };
};
