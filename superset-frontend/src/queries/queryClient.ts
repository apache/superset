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

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(
  overrides?: ConstructorParameters<typeof QueryClient>[0],
) {
  const { defaultOptions, ...rest } = overrides ?? {};
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,
        // Retry once, but never retry a 4xx — a client error won't succeed on
        // a retry and just delays surfacing the failure.
        retry: (failureCount, error) => {
          const status = (error as { status?: number } | null)?.status;
          if (typeof status === 'number' && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 1;
        },
        // Edit surfaces shouldn't silently refetch on window focus (it can drop
        // in-progress work); queries that want it opt in locally.
        refetchOnWindowFocus: false,
        ...defaultOptions?.queries,
      },
      mutations: {
        retry: 0,
        ...defaultOptions?.mutations,
      },
    },
    ...rest,
  });
}

export const queryClient = createQueryClient();
