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
import {
  SupersetClient,
  isFeatureEnabled,
  FeatureFlag,
} from '@superset-ui/core';

interface CssTemplate {
  template_name: string;
  css: string;
}

export const cssTemplateKeys = {
  all: ['cssTemplates'] as const,
} as const;

export function useCssTemplates(options?: { staleTime?: number }) {
  return useQuery({
    queryKey: cssTemplateKeys.all,
    queryFn: async () => {
      const query = rison.encode({ columns: ['template_name', 'css'] });
      const response = await SupersetClient.get({
        endpoint: `/api/v1/css_template/?q=${query}`,
      });
      return (response.json.result || []) as CssTemplate[];
    },
    enabled: isFeatureEnabled(FeatureFlag.CssTemplates),
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
  });
}
