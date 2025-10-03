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
import { useState, useCallback, useRef } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { StreamingProgress } from './StreamingExportModal';

interface UseStreamingExportOptions {
  onProgress?: (progress: StreamingProgress) => void;
  onComplete?: (downloadUrl: string, filename: string) => void;
  onError?: (error: string) => void;
}

interface StreamingExportParams {
  url: string;
  payload: any;
  filename?: string;
  exportType: 'csv' | 'xlsx';
  expectedRows?: number; // Total expected rows for progress calculation
}

export const useStreamingExport = (options: UseStreamingExportOptions = {}) => {
  const [progress, setProgress] = useState<StreamingProgress>({
    rowsProcessed: 0,
    totalRows: undefined,
    totalSize: 0,
    speed: 0,
    mbPerSecond: 0,
    elapsedTime: 0,
    status: 'streaming',
  });
  const [isExporting, setIsExporting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const bytesHistoryRef = useRef<Array<{ time: number; bytes: number }>>([]);

  const updateProgress = useCallback(
    (updates: Partial<StreamingProgress>) => {
      setProgress(prev => {
        const newProgress = { ...prev, ...updates };

        // 🔍 DEBUG: Log every progress update
        console.log('📊 FRONTEND PROGRESS UPDATE:', {
          rowsProcessed: newProgress.rowsProcessed,
          totalRows: newProgress.totalRows,
          percentage: newProgress.totalRows
            ? Math.round(
                (newProgress.rowsProcessed / newProgress.totalRows) * 100,
              )
            : 'N/A',
          totalSize: `${(newProgress.totalSize / 1024).toFixed(1)}KB`,
          status: newProgress.status,
          elapsedTime: `${newProgress.elapsedTime.toFixed(1)}s`,
        });

        options.onProgress?.(newProgress);
        return newProgress;
      });
    },
    [options],
  );

  const parseProgressFromHeaders = useCallback(
    (headers: Headers, elapsedTime: number) => {
      // Try to extract progress from response headers if backend provides them
      const progressHeader = headers.get('X-Export-Progress');
      if (progressHeader) {
        try {
          const [rows, bytes, rate] = progressHeader.split(',').map(Number);
          return {
            rowsProcessed: rows || 0,
            totalSize: bytes || 0,
            speed: rate || 0,
            mbPerSecond: bytes > 0 ? bytes / (1024 * 1024) / elapsedTime : 0,
            elapsedTime,
          };
        } catch (e) {
          console.warn('Failed to parse progress header:', e);
        }
      }
      return null;
    },
    [],
  );

  const estimateProgressFromSize = useCallback(
    (currentSize: number, elapsedTime: number, actualRows: number = 0) => {
      const now = Date.now();

      // Track bytes over time for smoother speed calculation
      bytesHistoryRef.current.push({ time: now, bytes: currentSize });

      // Keep only last 10 seconds of data for rolling average
      const cutoffTime = now - 10000;
      bytesHistoryRef.current = bytesHistoryRef.current.filter(
        entry => entry.time > cutoffTime,
      );

      if (elapsedTime <= 0) {
        return {
          rowsProcessed: actualRows,
          totalSize: currentSize,
          speed: 0,
          mbPerSecond: 0,
          elapsedTime,
        };
      }

      // Calculate speed based on recent data points for smoother updates
      let mbPerSecond = 0;
      if (bytesHistoryRef.current.length >= 2) {
        const oldest = bytesHistoryRef.current[0];
        const newest =
          bytesHistoryRef.current[bytesHistoryRef.current.length - 1];
        const timeDiff = (newest.time - oldest.time) / 1000;
        const bytesDiff = newest.bytes - oldest.bytes;

        if (timeDiff > 0) {
          mbPerSecond = bytesDiff / (1024 * 1024) / timeDiff;
        }
      }

      // If rolling average isn't available yet, use overall average
      if (mbPerSecond === 0) {
        mbPerSecond = currentSize / (1024 * 1024) / elapsedTime;
      }

      // Use actual row count if available, otherwise estimate
      let finalRowCount = actualRows;
      if (actualRows === 0) {
        // Fallback to size-based estimation only if no actual count
        const avgBytesPerRow =
          currentSize > 10000
            ? currentSize / Math.max(1, currentSize / 150)
            : 200;
        finalRowCount = Math.floor(currentSize / avgBytesPerRow);
      }

      const rowsPerSecond = finalRowCount / elapsedTime;

      return {
        rowsProcessed: finalRowCount,
        totalSize: currentSize,
        speed: rowsPerSecond,
        mbPerSecond,
        elapsedTime,
      };
    },
    [],
  );

  const startExport = useCallback(
    async ({
      url,
      payload,
      filename,
      exportType,
      expectedRows,
    }: StreamingExportParams) => {
      if (isExporting) {
        console.warn('Export already in progress');
        return;
      }

      setIsExporting(true);
      abortControllerRef.current = new AbortController();
      startTimeRef.current = Date.now();
      lastUpdateRef.current = Date.now();
      bytesHistoryRef.current = []; // Reset bytes history for new export

      console.log('🚀 FRONTEND STREAMING START:', {
        url,
        filename,
        expectedRows,
        exportType,
      });

      updateProgress({
        rowsProcessed: 0,
        totalRows: expectedRows,
        totalSize: 0,
        speed: 0,
        mbPerSecond: 0,
        elapsedTime: 0,
        status: 'streaming',
        filename,
      });

      // Start polling for progress using filename as export ID
      const pollInterval = setInterval(async () => {
        try {
          const progressUrl = `/api/v1/chart/export/progress/${encodeURIComponent(
            filename || `export.${exportType}`,
          )}`;
          console.log('📊 POLLING PROGRESS:', progressUrl);

          const progressResponse = await SupersetClient.get({
            endpoint: progressUrl,
          });

          if (progressResponse.json) {
            const serverProgress = progressResponse.json;
            console.log('📈 SERVER PROGRESS:', serverProgress);

            // Update progress from server response
            updateProgress({
              rowsProcessed: serverProgress.rows_processed || 0,
              totalRows: serverProgress.total_rows || expectedRows,
              totalSize: serverProgress.bytes_processed || 0,
              speed: serverProgress.speed_rows_per_sec || 0,
              mbPerSecond: serverProgress.speed_mb_per_sec || 0,
              elapsedTime: serverProgress.elapsed_time || 0,
              status: serverProgress.status || 'streaming',
            });

            // Stop polling if completed or error
            if (
              serverProgress.status === 'completed' ||
              serverProgress.status === 'error'
            ) {
              console.log('✅ POLLING STOPPED: Export finished');
              clearInterval(pollInterval);
            }
          }
        } catch (pollError) {
          // Silently ignore polling errors - the main stream will handle failures
          console.warn('⚠️ Progress polling error (non-critical):', pollError);
        }
      }, 500); // Poll every 500ms as requested

      try {
        // Initialize SupersetClient to ensure authentication and get CSRF token
        await SupersetClient.init();
        const csrfToken = await SupersetClient.getCSRFToken();

        // Use manual fetch for streaming while leveraging SupersetClient's authentication
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(csrfToken && { 'X-CSRFToken': csrfToken }),
          },
          body: new URLSearchParams({
            form_data: JSON.stringify(payload),
            filename: filename || `export.${exportType}`, // Pass filename to backend
            expected_rows: expectedRows?.toString() || '', // Pass expected row count to backend
          }),
          signal: abortControllerRef.current.signal,
          credentials: 'same-origin',
        });

        console.log('📡 FRONTEND RESPONSE:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          hasBody: !!response.body,
        });

        if (!response.ok) {
          throw new Error(
            `Export failed: ${response.status} ${response.statusText}`,
          );
        }

        if (!response.body) {
          throw new Error('Response body is not available for streaming');
        }

        console.log('🔧 STARTING STREAM READER');
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedLength = 0;
        let chunkCount = 0;

        // Note: We rely on the polling interval (pollInterval) for progress updates
        // No need for a separate progressInterval since the server tracks actual progress

        try {
          // Read the streaming response
          console.log('🔄 ENTERING STREAM READ LOOP');
          while (true) {
            console.log('🔄 CALLING reader.read()...');
            const { done, value } = await reader.read();

            console.log('📡 READER RESULT:', {
              done,
              hasValue: !!value,
              valueLength: value?.length,
            });

            if (done) {
              console.log('✅ STREAM READING COMPLETED');
              break;
            }

            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Export cancelled by user');
            }

            chunkCount++;
            chunks.push(value);
            receivedLength += value.length;

            console.log('📊 CHUNK RECEIVED:', {
              chunkNumber: chunkCount,
              chunkSize: value.length,
              totalReceived: receivedLength,
            });
          }

          clearInterval(pollInterval); // Stop polling when stream completes

          // Create blob from chunks
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

          const blob = new Blob([completeData], { type: mimeType });
          const downloadUrl = URL.createObjectURL(blob);

          // Mark as completed - final progress will come from the last poll
          updateProgress({
            status: 'completed',
            downloadUrl,
            filename: filename || `export.${exportType}`,
          });

          options.onComplete?.(downloadUrl, filename || `export.${exportType}`);
        } catch (streamError) {
          clearInterval(pollInterval); // Stop polling on error
          throw streamError;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';

        if (
          errorMessage.includes('cancelled') ||
          errorMessage.includes('aborted')
        ) {
          updateProgress({
            status: 'cancelled',
          });
        } else {
          updateProgress({
            status: 'error',
            error: errorMessage,
          });
          options.onError?.(errorMessage);
        }
      } finally {
        setIsExporting(false);
        abortControllerRef.current = null;
      }
    },
    [
      isExporting,
      updateProgress,
      parseProgressFromHeaders,
      estimateProgressFromSize,
      options,
    ],
  );

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      updateProgress({
        status: 'cancelled',
      });
    }
  }, [updateProgress]);

  const resetExport = useCallback(() => {
    setIsExporting(false);
    abortControllerRef.current = null;
    setProgress({
      rowsProcessed: 0,
      totalRows: undefined,
      totalSize: 0,
      speed: 0,
      mbPerSecond: 0,
      elapsedTime: 0,
      status: 'streaming',
    });
  }, []);

  return {
    progress,
    isExporting,
    startExport,
    cancelExport,
    resetExport,
  };
};
