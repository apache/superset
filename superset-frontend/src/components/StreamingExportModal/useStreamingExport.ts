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
import { ExportStatus, StreamingProgress } from './StreamingExportModal';

interface UseStreamingExportOptions {
  onComplete?: (downloadUrl: string, filename: string) => void;
  onError?: (error: string) => void;
}

interface StreamingExportParams {
  url: string;
  payload: any;
  filename?: string;
  exportType: 'csv' | 'xlsx';
  expectedRows?: number;
}

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
  const [isExporting, setIsExporting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateProgress = useCallback(
    (updates: Partial<StreamingProgress>) => {
      setProgress(prev => ({ ...prev, ...updates }));
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
      if (isExporting) return;

      setIsExporting(true);
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
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            form_data: JSON.stringify(payload),
            filename: filename || `export.${exportType}`,
            expected_rows: expectedRows?.toString() || '',
          }),
          signal: abortControllerRef.current.signal,
          credentials: 'same-origin',
        });

        if (!response.ok) {
          throw new Error(
            `Export failed: ${response.status} ${response.statusText}`,
          );
        }

        if (!response.body) {
          throw new Error('Response body is not available for streaming');
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedLength = 0;
        let rowsProcessed = 0;
        const NEWLINE_BYTE = 10; // '\n' character code

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Export cancelled by user');
            }

            chunks.push(value);
            receivedLength += value.length;

            // Count newlines directly in binary (faster than decoding + regex)
            let newlineCount = 0;
            for (let i = 0; i < value.length; i++) {
              if (value[i] === NEWLINE_BYTE) {
                newlineCount++;
              }
            }
            rowsProcessed += newlineCount;

            // Update progress based on rows processed
            updateProgress({
              status: ExportStatus.STREAMING,
              rowsProcessed,
              totalRows: expectedRows,
              totalSize: receivedLength,
            });
          }

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

          updateProgress({
            status: ExportStatus.COMPLETED,
            downloadUrl,
            filename: filename || `export.${exportType}`,
          });

          options.onComplete?.(downloadUrl, filename || `export.${exportType}`);
        } catch (streamError) {
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
            status: ExportStatus.CANCELLED,
          });
        } else {
          updateProgress({
            status: ExportStatus.ERROR,
            error: errorMessage,
          });
          options.onError?.(errorMessage);
        }
      } finally {
        setIsExporting(false);
        abortControllerRef.current = null;
      }
    },
    [isExporting, updateProgress, options],
  );

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      updateProgress({
        status: ExportStatus.CANCELLED,
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
      status: ExportStatus.STREAMING,
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
