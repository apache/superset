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
import { useState, useCallback } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import { ensureAppRoot } from 'src/utils/pathUtils';

export interface ChartExportData {
  chartId: number;
  chartName: string;
  data: any[];
  columns: string[];
  status: 'pending' | 'exporting' | 'success' | 'error';
  error?: string;
}

export interface BulkExportProgress {
  current: number;
  total: number;
  charts: ChartExportData[];
}

export interface UseBulkExportProps {
  onComplete?: (results: ChartExportData[]) => void;
  onError?: (error: string) => void;
}

export const useBulkExport = ({
  onComplete,
  onError,
}: UseBulkExportProps = {}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<BulkExportProgress>({
    current: 0,
    total: 0,
    charts: [],
  });

  const sanitizeSheetName = (name: string): string => {
    // Excel sheet names: max 31 chars, no special characters
    let sanitized = name
      .replace(/[:\\/?*[\]]/g, '_') // Replace invalid chars
      .substring(0, 31); // Truncate to 31 chars

    return sanitized || 'Sheet';
  };

  const exportSingleChart = async (
    chartId: number,
    chartName: string,
    formData: any,
  ): Promise<ChartExportData> => {
    const chartData: ChartExportData = {
      chartId,
      chartName,
      data: [],
      columns: [],
      status: 'exporting',
    };

    try {
      // Build query payload
      const payload = await buildV1ChartDataPayload({
        formData: {
          ...formData,
          slice_id: chartId,
        },
        force: false,
        resultFormat: 'json',
        resultType: 'full',
        setDataMask: () => {},
        ownState: {},
      });

      // Call chart data API
      const response = await SupersetClient.post({
        endpoint: ensureAppRoot('/api/v1/chart/data'),
        jsonPayload: payload,
      });

      // Extract data from response
      if (response.json?.result?.[0]) {
        const queryResult = response.json.result[0];
        chartData.data = queryResult.data || [];
        chartData.columns = queryResult.colnames || [];
        chartData.status = 'success';
      } else {
        throw new Error('No data returned from API');
      }
    } catch (error: any) {
      chartData.status = 'error';
      chartData.error = error.message || 'Failed to export chart';
    }

    return chartData;
  };

  const exportCharts = useCallback(
    async (charts: { id: number; name: string; formData: any }[]) => {
      setIsExporting(true);

      const initialCharts: ChartExportData[] = charts.map(chart => ({
        chartId: chart.id,
        chartName: chart.name,
        data: [],
        columns: [],
        status: 'pending',
      }));

      setProgress({
        current: 0,
        total: charts.length,
        charts: initialCharts,
      });

      const results: ChartExportData[] = [];

      // Export charts sequentially to avoid overwhelming the server
      for (let i = 0; i < charts.length; i += 1) {
        const chart = charts[i];

        // Update progress: mark current chart as exporting
        setProgress(prev => ({
          ...prev,
          current: i + 1,
          charts: prev.charts.map(c =>
            c.chartId === chart.id ? { ...c, status: 'exporting' } : c,
          ),
        }));

        // Export the chart
        const result = await exportSingleChart(
          chart.id,
          chart.name,
          chart.formData,
        );
        results.push(result);

        // Update progress: mark chart as complete
        setProgress(prev => ({
          ...prev,
          charts: prev.charts.map(c => (c.chartId === chart.id ? result : c)),
        }));
      }

      setIsExporting(false);

      // Check if any succeeded
      const successCount = results.filter(r => r.status === 'success').length;

      if (successCount === 0) {
        onError?.('All chart exports failed');
      } else {
        onComplete?.(results);
      }

      return results;
    },
    [onComplete, onError],
  );

  const generateExcelFile = useCallback(
    async (results: ChartExportData[], dashboardTitle: string) => {
      // Dynamically import xlsx to reduce initial bundle size
      const XLSX = await import('xlsx');

      const workbook = XLSX.utils.book_new();

      // Track sheet names to handle duplicates
      const usedSheetNames = new Set<string>();

      results.forEach(result => {
        if (result.status !== 'success' || !result.data.length) {
          return; // Skip failed or empty charts
        }

        // Generate unique sheet name
        let sheetName = sanitizeSheetName(result.chartName);
        let counter = 1;

        while (usedSheetNames.has(sheetName)) {
          const baseName = sanitizeSheetName(result.chartName).substring(0, 28);
          sheetName = `${baseName}(${counter})`;
          counter += 1;
        }

        usedSheetNames.add(sheetName);

        // Convert data to worksheet
        const worksheet = XLSX.utils.json_to_sheet(result.data);

        // Auto-size columns (approximate)
        const columnWidths = result.columns.map(col => ({
          wch: Math.max(10, col.length + 2),
        }));
        worksheet['!cols'] = columnWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      // Generate filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .substring(0, 19);
      const sanitizedTitle = dashboardTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${sanitizedTitle}_${timestamp}.xlsx`;

      // Trigger download
      XLSX.writeFile(workbook, filename);

      return filename;
    },
    [],
  );

  const reset = useCallback(() => {
    setIsExporting(false);
    setProgress({
      current: 0,
      total: 0,
      charts: [],
    });
  }, []);

  return {
    isExporting,
    progress,
    exportCharts,
    generateExcelFile,
    reset,
  };
};
