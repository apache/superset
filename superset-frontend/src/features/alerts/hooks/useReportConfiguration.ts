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
import { useCallback, useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import type { ReportConfiguration } from 'src/features/alerts/types';

interface UseReportConfigurationState {
  configuration: ReportConfiguration | null;
  loading: boolean;
  error: boolean;
}

/**
 * Loads the global Alerts & Reports configuration in effect.
 *
 * Consumers should treat a `null` configuration as "unknown" and fall back to
 * their legacy defaults (feature flags) until the request resolves.
 */
export function useReportConfiguration(enabled = true) {
  const [state, setState] = useState<UseReportConfigurationState>({
    configuration: null,
    loading: enabled,
    error: false,
  });

  const refresh = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: false }));
    try {
      const response = await SupersetClient.get({
        endpoint: '/api/v1/report/configuration/',
      });
      const configuration = response.json?.result as ReportConfiguration;
      setState({ configuration, loading: false, error: false });
      return configuration;
    } catch {
      setState(current => ({ ...current, loading: false, error: true }));
      return null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      refresh();
    }
  }, [enabled, refresh]);

  return { ...state, refresh };
}
