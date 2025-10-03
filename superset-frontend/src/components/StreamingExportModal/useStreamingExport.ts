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
        let actualRowCount = 0;
        let accumulatedText = '';
        let chunkCount = 0;

        // More frequent progress updates for smoother UI
        const progressInterval = setInterval(() => {
          const now = Date.now();
          const elapsedTime = (now - startTimeRef.current) / 1000;

          // Always use the enhanced progress calculation with actual rows when available
          const progressData = estimateProgressFromSize(
            receivedLength,
            elapsedTime,
            actualRowCount,
          );

          // 🔍 DEBUG: Log interval-based progress updates
          console.log('⏱️ FRONTEND INTERVAL UPDATE:', {
            receivedLength,
            actualRowCount,
            elapsedTime: elapsedTime.toFixed(1),
            progressData,
          });

          updateProgress(progressData);
        }, 200); // Update every 200ms for smoother progress

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
            const oldReceivedLength = receivedLength;
            const oldRowCount = actualRowCount;
            receivedLength += value.length;

            console.log('📊 CHUNK RECEIVED:', {
              chunkNumber: chunkCount,
              chunkSize: value.length,
              totalReceived: receivedLength,
            });

            // Convert chunk to text and count rows in real-time
            try {
              const chunkText = new TextDecoder().decode(value, {
                stream: true,
              });
              accumulatedText += chunkText;

              // Count complete lines (rows) in accumulated text
              const lines = accumulatedText.split('\n');

              // Keep the last incomplete line for next iteration
              if (lines.length > 1) {
                accumulatedText = lines[lines.length - 1]; // Keep incomplete line

                // Count completed lines (subtract 1 for header if this is first chunk)
                const completedLines = lines.length - 1;
                if (actualRowCount === 0 && completedLines > 0) {
                  // First chunk - subtract 1 for header row
                  actualRowCount = completedLines - 1;
                } else {
                  // Subsequent chunks - add all completed lines
                  actualRowCount += completedLines;
                }
              }

              // 🔍 DEBUG: Log chunk processing and update progress immediately
              if (
                actualRowCount !== oldRowCount ||
                receivedLength !== oldReceivedLength
              ) {
                console.log('📦 FRONTEND CHUNK PROCESSED:', {
                  chunkSize: value.length,
                  totalBytes: receivedLength,
                  newRows: actualRowCount - oldRowCount,
                  totalRows: actualRowCount,
                  linesInChunk: lines.length - 1,
                  chunkTextPreview: `${chunkText.substring(0, 100)}...`,
                });

                // Immediately update progress with actual row count from chunk
                const now = Date.now();
                const elapsedTime = (now - startTimeRef.current) / 1000;
                const progressData = estimateProgressFromSize(
                  receivedLength,
                  elapsedTime,
                  actualRowCount,
                );
                updateProgress(progressData);
              }
            } catch (decodeError) {
              // If text decoding fails, fall back to byte-based estimation
              console.warn(
                '❌ Failed to decode chunk for row counting:',
                decodeError,
              );
            }
          }

          clearInterval(progressInterval);

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

          const finalElapsedTime = (Date.now() - startTimeRef.current) / 1000;

          // Try to get accurate final count from server headers first
          const headerProgress = parseProgressFromHeaders(
            response.headers,
            finalElapsedTime,
          );

          let finalProgress;
          if (headerProgress && headerProgress.rowsProcessed > 0) {
            // Use server-provided count if available
            finalProgress = headerProgress;
          } else {
            // Use the real-time counted rows if available, otherwise parse final data
            let finalRowCount = actualRowCount;

            if (finalRowCount === 0) {
              // Fallback: parse the complete data for final count
              try {
                const text = new TextDecoder().decode(completeData);
                const lines = text.split(/\r?\n/);
                // Subtract 1 for header row, filter out empty lines
                finalRowCount =
                  lines.filter(line => line.trim().length > 0).length - 1;
                finalRowCount = Math.max(0, finalRowCount);
              } catch (e) {
                // Final fallback to size-based estimation
                finalRowCount = Math.floor(receivedLength / 200);
              }
            }

            finalProgress = {
              rowsProcessed: finalRowCount,
              totalSize: receivedLength,
              speed: finalRowCount / finalElapsedTime,
              mbPerSecond: receivedLength / (1024 * 1024) / finalElapsedTime,
              elapsedTime: finalElapsedTime,
            };
          }

          updateProgress({
            ...finalProgress,
            status: 'completed',
            downloadUrl,
            filename: filename || `export.${exportType}`,
          });

          options.onComplete?.(downloadUrl, filename || `export.${exportType}`);
        } catch (streamError) {
          clearInterval(progressInterval);
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
