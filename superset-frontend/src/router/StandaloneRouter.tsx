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
import { ReactNode, useEffect, useState } from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
  type RouterHistory,
} from '@tanstack/react-router';
import { parseSearch, stringifySearch } from './searchParams';

/**
 * A minimal router host for trees that need router context (Link,
 * useNavigate, useLocation, useBlocker) without the SPA route table:
 * the menu entry rendered on Flask-served pages, and component tests.
 *
 * Children are rendered directly inside RouterContextProvider (rather
 * than through RouterProvider's async match rendering) so the tree
 * mounts synchronously — required by tests that query right after
 * render().
 */

export interface StandaloneRouterProps {
  children?: ReactNode;
  basepath?: string;
  /** When provided, an in-memory history is used (tests). */
  initialEntries?: string[];
  initialIndex?: number;
  /** Explicit history instance (tests that assert on navigation). */
  history?: RouterHistory;
}

export function createStandaloneRouter({
  basepath,
  initialEntries,
  initialIndex,
  history,
}: Omit<StandaloneRouterProps, 'children'> = {}) {
  return createRouter({
    routeTree: createRootRoute(),
    basepath,
    history:
      history ??
      (initialEntries
        ? createMemoryHistory({ initialEntries, initialIndex })
        : undefined),
    parseSearch,
    stringifySearch,
    trailingSlash: 'preserve',
    defaultPreload: false,
  });
}

export function StandaloneRouter({
  children,
  ...routerOptions
}: StandaloneRouterProps) {
  const [router] = useState(() => createStandaloneRouter(routerOptions));

  // RouterProvider's internal Transitioner normally wires history changes
  // to router state; replicate that minimal wiring since we render
  // children directly instead of through RouterProvider. No initial
  // load(): location state is already populated by createRouter, and the
  // extra state flush would re-render consumers (which breaks tests that
  // mock selectors with mockReturnValueOnce sequences).
  useEffect(() => router.history.subscribe(router.load), [router]);

  return (
    <RouterContextProvider router={router}>{children}</RouterContextProvider>
  );
}
