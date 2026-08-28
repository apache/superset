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
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';

export interface ExecuteReportResponse {
  execution_id: string;
  message: string;
}

interface ErrorPayload {
  message?: string;
}

interface UseExecuteReportScheduleState {
  loading: boolean;
  error: string | null;
}

export function useExecuteReportSchedule() {
  const [state, setState] = useState<UseExecuteReportScheduleState>({
    loading: false,
    error: null,
  });

  const executeReport = useCallback(
    async (
      reportId: number,
      onSuccess?: (response: ExecuteReportResponse) => void,
      onError?: (error: string) => void,
    ): Promise<ExecuteReportResponse> => {
      setState({ loading: true, error: null });

      try {
        const response = await SupersetClient.post({
          endpoint: `/api/v1/report/${reportId}/execute`,
        });

        const result = response.json as ExecuteReportResponse;
        setState({ loading: false, error: null });

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        let errorMessage = t('An error occurred while triggering the report');

        // SupersetClient rejects non-2xx responses with the raw Response object
        if (error instanceof Response) {
          try {
            const errorJson: ErrorPayload = await error.json();
            if (errorJson?.message) {
              errorMessage = errorJson.message;
            }
          } catch {
            // JSON parse failed — keep the default message
          }
        }

        setState({ loading: false, error: errorMessage });

        if (onError) {
          onError(errorMessage);
        }

        throw error;
      }
    },
    [],
  );

  return {
    executeReport,
    loading: state.loading,
    error: state.error,
  };
}
