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
import rison from 'rison';
import { useQuery } from '@tanstack/react-query';
import { SupersetClient } from '@superset-ui/core';
import { themeKeys } from '../keys';

export interface ThemeOption {
  id: number;
  theme_name: string;
  json_data?: string;
}

const NON_SYSTEM_THEMES_QUERY = rison.encode({
  columns: ['id', 'theme_name', 'is_system', 'json_data'],
  filters: [{ col: 'is_system', opr: 'eq', value: false }],
});

/** Fetches the non-system themes shown in the dashboard properties theme picker. */
export function useThemes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: themeKeys.list(NON_SYSTEM_THEMES_QUERY),
    queryFn: async () => {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/theme/?q=${NON_SYSTEM_THEMES_QUERY}`,
      });
      return (response.json.result ?? []) as ThemeOption[];
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
