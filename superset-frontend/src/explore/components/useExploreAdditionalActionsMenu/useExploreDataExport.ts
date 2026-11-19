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

import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  JsonObject,
  LatestQueryFormData,
  QueryFormData,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  StreamingProgress,
  useStreamingExport,
} from 'src/components/StreamingExportModal';
import { DEFAULT_CSV_STREAMING_ROW_THRESHOLD } from 'src/constants';
import { exportChart, getChartKey } from 'src/explore/exploreUtils';
import { ChartState } from 'src/explore/types';
import { Slice } from 'src/types/Chart';

interface ExploreSlice {
  slice?: Slice | null;
}

interface ExploreState {
  charts?: Record<number, ChartState>;
  explore?: ExploreSlice;
  common?: {
    conf?: {
      CSV_STREAMING_ROW_THRESHOLD?: number;
    };
  };
}

export interface StreamingExportState {
  isVisible: boolean;
  progress: StreamingProgress;
  onCancel: () => void;
  onRetry: () => void;
  onDownload: () => void;
}

interface UseExploreDataExportProps {
  latestQueryFormData: LatestQueryFormData;
  canDownloadCSV: boolean;
  slice?: Slice | null;
  ownState?: JsonObject;
}

export const useExploreDataExport = ({
  latestQueryFormData,
  canDownloadCSV,
  slice,
  ownState,
}: UseExploreDataExportProps) => {
  const { addDangerToast, addSuccessToast } = useToasts();

  const chart = useSelector<ExploreState, ChartState | undefined>(state =>
    state.explore ? state.charts?.[getChartKey(state.explore)] : undefined,
  );

  const streamingThreshold = useSelector<ExploreState, number>(
    state =>
      state.common?.conf?.CSV_STREAMING_ROW_THRESHOLD ||
      DEFAULT_CSV_STREAMING_ROW_THRESHOLD,
  );

  const [isStreamingModalVisible, setIsStreamingModalVisible] = useState(false);

  const { progress, startExport, resetExport, retryExport } =
    useStreamingExport({
      onComplete: () => {
        // Wait for the user to click Download before showing a success toast.
      },
      onError: () => {
        addDangerToast(t('Export failed - please try again'));
      },
    });

  const handleCloseStreamingModal = useCallback(() => {
    setIsStreamingModalVisible(false);
    resetExport();
  }, [resetExport]);

  const handleDownloadComplete = useCallback(() => {
    addSuccessToast(t('CSV file downloaded successfully'));
  }, [addSuccessToast]);

  const handleExportError = useCallback(
    (error: unknown) => {
      const exportError = error as Error & {
        status?: number;
        statusText?: string;
        response?: { status?: number };
      };
      const status = exportError.status || exportError.response?.status;

      if (status === 413) {
        addDangerToast(
          t(
            'The chart data is too large to download. Please try reducing the date range, limiting rows, or using fewer columns.',
          ),
        );
      } else {
        const errorMessage =
          exportError.message ||
          exportError.statusText ||
          t(
            'Failed to export chart data. Please try again or contact your administrator.',
          );
        addDangerToast(errorMessage);
      }
    },
    [addDangerToast],
  );

  const exportCSV = useCallback(async () => {
    if (!canDownloadCSV) return null;

    let actualRowCount;
    const isTableViz = latestQueryFormData?.viz_type === 'table';
    const queriesResponse = chart?.queriesResponse;

    if (
      isTableViz &&
      queriesResponse &&
      queriesResponse.length > 1 &&
      queriesResponse[1]?.data?.[0]?.rowcount
    ) {
      actualRowCount = queriesResponse[1].data[0].rowcount;
    } else if (queriesResponse && queriesResponse[0]?.sql_rowcount != null) {
      actualRowCount = queriesResponse[0].sql_rowcount;
    } else if (queriesResponse && queriesResponse[0]?.rowcount != null) {
      actualRowCount = queriesResponse[0].rowcount;
    } else {
      actualRowCount = latestQueryFormData?.row_limit;
    }

    const shouldUseStreaming =
      actualRowCount && actualRowCount >= streamingThreshold;

    let filename: string | undefined;
    if (shouldUseStreaming) {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toISOString().slice(11, 19).replace(/:/g, '');
      const timestamp = `_${date}_${time}`;
      const chartName =
        slice?.slice_name || latestQueryFormData.viz_type || 'chart';
      const safeChartName = chartName.replace(/[^a-zA-Z0-9_-]/g, '_');
      filename = `${safeChartName}${timestamp}.csv`;
    }

    try {
      await exportChart({
        formData: latestQueryFormData as QueryFormData,
        ownState,
        resultType: 'full',
        resultFormat: 'csv',
        onStartStreamingExport: shouldUseStreaming
          ? exportParams => {
              if (exportParams.url) {
                setIsStreamingModalVisible(true);
                startExport({
                  ...exportParams,
                  url: exportParams.url,
                  filename,
                  expectedRows: actualRowCount,
                  exportType: exportParams.exportType as 'csv' | 'xlsx',
                });
              }
            }
          : null,
      });
    } catch (error) {
      handleExportError(error);
    }

    return null;
  }, [
    canDownloadCSV,
    latestQueryFormData,
    ownState,
    chart,
    streamingThreshold,
    slice,
    startExport,
    handleExportError,
  ]);

  const exportCSVPivoted = useCallback(async () => {
    if (!canDownloadCSV) return null;

    try {
      await exportChart({
        formData: latestQueryFormData as QueryFormData,
        ownState,
        resultType: 'post_processed',
        resultFormat: 'csv',
      });
    } catch (error) {
      handleExportError(error);
    }

    return null;
  }, [canDownloadCSV, latestQueryFormData, ownState, handleExportError]);

  const exportJson = useCallback(async () => {
    if (!canDownloadCSV) return null;

    try {
      await exportChart({
        formData: latestQueryFormData as QueryFormData,
        ownState,
        resultType: 'results',
        resultFormat: 'json',
      });
    } catch (error) {
      handleExportError(error);
    }

    return null;
  }, [canDownloadCSV, latestQueryFormData, ownState, handleExportError]);

  const exportExcel = useCallback(async () => {
    if (!canDownloadCSV) return null;

    try {
      await exportChart({
        formData: latestQueryFormData as QueryFormData,
        ownState,
        resultType: 'results',
        resultFormat: 'xlsx',
      });
    } catch (error) {
      handleExportError(error);
    }

    return null;
  }, [canDownloadCSV, latestQueryFormData, ownState, handleExportError]);

  const streamingExportState: StreamingExportState = {
    isVisible: isStreamingModalVisible,
    progress,
    onCancel: handleCloseStreamingModal,
    onRetry: retryExport,
    onDownload: handleDownloadComplete,
  };

  return {
    exportCSV,
    exportCSVPivoted,
    exportJson,
    exportExcel,
    handleExportError,
    streamingExportState,
  };
};
