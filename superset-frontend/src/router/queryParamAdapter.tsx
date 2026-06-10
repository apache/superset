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
import { useRouter, useRouterState } from '@tanstack/react-router';
import type {
  PartialLocation,
  QueryParamAdapter,
  QueryParamAdapterComponent,
} from 'use-query-params';

const normalizeSearch = (search: string | undefined): string => {
  if (!search) return '';
  return search.startsWith('?') ? search : `?${search}`;
};

/**
 * use-query-params adapter backed by the TanStack router, replacing
 * ReactRouter5Adapter. Pushes go through the router's history with the
 * raw search string so rison payloads round-trip untouched.
 */
export const TanstackRouterAdapter: QueryParamAdapterComponent = ({
  children,
}) => {
  const router = useRouter();
  const location = useRouterState({ select: state => state.location });

  const navigate = (to: PartialLocation, replace: boolean) => {
    const { pathname } = router.state.location;
    const href = `${pathname}${normalizeSearch(to.search)}`;
    if (replace) {
      router.history.replace(href, to.state as never);
    } else {
      router.history.push(href, to.state as never);
    }
  };

  const adapter: QueryParamAdapter = {
    location: {
      search: normalizeSearch(location.searchStr),
      state: location.state,
    },
    push: to => navigate(to, false),
    replace: to => navigate(to, true),
  };

  return children(adapter);
};
