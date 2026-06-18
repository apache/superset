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

/**
 * @fileoverview Host-internal implementation of the `navigation` namespace.
 *
 * Derives the current {@link Page} from the browser location by matching
 * against {@link RoutePaths}. Call {@link useNavigationTracker} once in the
 * app shell to keep the page in sync with React Router.
 */

import { useEffect, useRef } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import type { navigation as navigationApi } from '@apache-superset/core';
import { RoutePaths } from '../../views/routePaths';
import { Disposable } from '../models';
import { createValueEventEmitter } from '../utils';

type Page = navigationApi.Page;

/** Maps route path patterns to their corresponding Page type. */
const PAGE_ROUTES: { path: string; page: Page }[] = [
  { path: RoutePaths.DASHBOARD, page: 'dashboard' },
  { path: RoutePaths.DASHBOARD_LIST, page: 'dashboard_list' },
  { path: RoutePaths.QUERY_HISTORY, page: 'query_history' },
  { path: RoutePaths.SAVED_QUERIES, page: 'saved_queries' },
  { path: RoutePaths.SQLLAB, page: 'sqllab' },
  { path: RoutePaths.CHART_ADD, page: 'explore' },
  { path: RoutePaths.CHART_LIST, page: 'chart_list' },
  { path: RoutePaths.EXPLORE, page: 'explore' },
  { path: RoutePaths.EXPLORE_PERMALINK, page: 'explore' },
  { path: RoutePaths.DATASET_LIST, page: 'dataset_list' },
  { path: RoutePaths.DATASET_ADD, page: 'dataset' },
  { path: RoutePaths.DATASET, page: 'dataset' },
];

function derivePage(pathname: string): Page {
  for (const { path, page } of PAGE_ROUTES) {
    if (matchPath(pathname, { path, exact: false })) return page;
  }
  return 'home';
}

const pageEmitter = createValueEventEmitter<Page>(
  derivePage(window.location.pathname),
);

/** Updates the current page from a pathname. No-op when the page is unchanged. */
export const notifyLocationChanged = (pathname: string): void => {
  const next = derivePage(pathname);
  if (next === pageEmitter.getCurrent()) return;
  pageEmitter.fire(next);
};

const getPage: typeof navigationApi.getPage = () => pageEmitter.getCurrent();

const onDidChangePage: typeof navigationApi.onDidChangePage = (
  listener: (page: Page) => void,
  thisArgs?: unknown,
): Disposable => pageEmitter.subscribe(listener, thisArgs);

/** Synchronizes the navigation module with React Router. Call once in the app shell. */
export const useNavigationTracker = () => {
  const location = useLocation();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    if (prevPathname.current !== location.pathname) {
      prevPathname.current = location.pathname;
      notifyLocationChanged(location.pathname);
    }
  }, [location.pathname]);
};

export const navigation: typeof navigationApi = {
  getPage,
  onDidChangePage,
};
