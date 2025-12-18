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
import { SupersetClient, logging } from '@superset-ui/core';
import type { GenerateDashboardResponse } from '../types';
import { USE_MOCK_DATA } from '../config';

interface MutationState {
  loading: boolean;
  error: string | null;
}

interface UseSchemaEditorMutationsReturn {
  updateTableDescription: (
    tableId: number,
    description: string | null,
  ) => Promise<boolean>;
  updateColumnDescription: (
    columnId: number,
    description: string | null,
  ) => Promise<boolean>;
  generateDashboard: (
    reportId: number,
    dashboardId: number,
  ) => Promise<string | null>;
  mutationState: MutationState;
}

export default function useSchemaEditorMutations(): UseSchemaEditorMutationsReturn {
  const [mutationState, setMutationState] = useState<MutationState>({
    loading: false,
    error: null,
  });

  const updateTableDescription = useCallback(
    async (tableId: number, description: string | null): Promise<boolean> => {
      setMutationState({ loading: true, error: null });

      // Use mock for testing
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 300));
        logging.info(
          `Mock: Updated table ${tableId} description to:`,
          description,
        );
        setMutationState({ loading: false, error: null });
        return true;
      }

      try {
        await SupersetClient.put({
          endpoint: `/api/v1/datasource/analysis/table/${tableId}`,
          jsonPayload: { description },
        });
        setMutationState({ loading: false, error: null });
        return true;
      } catch (err) {
        logging.error('Error updating table description:', err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to update table description';
        setMutationState({ loading: false, error: errorMessage });
        return false;
      }
    },
    [],
  );

  const updateColumnDescription = useCallback(
    async (columnId: number, description: string | null): Promise<boolean> => {
      setMutationState({ loading: true, error: null });

      // Use mock for testing
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 300));
        logging.info(
          `Mock: Updated column ${columnId} description to:`,
          description,
        );
        setMutationState({ loading: false, error: null });
        return true;
      }

      try {
        await SupersetClient.put({
          endpoint: `/api/v1/datasource/analysis/column/${columnId}`,
          jsonPayload: { description },
        });
        setMutationState({ loading: false, error: null });
        return true;
      } catch (err) {
        logging.error('Error updating column description:', err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to update column description';
        setMutationState({ loading: false, error: errorMessage });
        return false;
      }
    },
    [],
  );

  const generateDashboard = useCallback(
    async (reportId: number, dashboardId: number): Promise<string | null> => {
      setMutationState({ loading: true, error: null });

      // Use mock for testing
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const mockRunId = `mock-run-${Date.now()}`;
        logging.info(`Mock: Generated dashboard with run_id: ${mockRunId}`);
        setMutationState({ loading: false, error: null });
        return mockRunId;
      }

      try {
        const response = await SupersetClient.post({
          endpoint: '/api/v1/datasource/analysis/generate',
          jsonPayload: {
            report_id: reportId,
            dashboard_id: dashboardId,
          },
        });
        const data = response.json as GenerateDashboardResponse;
        setMutationState({ loading: false, error: null });
        return data.result.run_id;
      } catch (err) {
        logging.error('Error generating dashboard:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate dashboard';
        setMutationState({ loading: false, error: errorMessage });
        return null;
      }
    },
    [],
  );

  return {
    updateTableDescription,
    updateColumnDescription,
    generateDashboard,
    mutationState,
  };
}
