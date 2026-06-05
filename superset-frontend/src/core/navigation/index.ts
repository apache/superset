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
 * Host-internal implementation of the `navigation` namespace.
 *
 * Backed by browser location — no Redux dependency.
 * The app shell calls `notifyPageChange(pathname)` whenever the route changes.
 */

import type { navigation as navigationApi } from '@apache-superset/core';
import { Disposable } from '../models';

type PageType = navigationApi.PageType;

const listeners = new Set<(pageType: PageType) => void>();

function derivePageType(pathname: string): PageType {
  if (pathname.startsWith('/superset/dashboard/')) return 'dashboard';
  if (pathname.startsWith('/dashboard/list')) return 'dashboard_list';
  if (pathname.startsWith('/explore/')) return 'explore';
  if (pathname.startsWith('/superset/explore/')) return 'explore';
  if (pathname.startsWith('/chart/add')) return 'explore';
  if (pathname.startsWith('/chart/list')) return 'chart_list';
  if (pathname.startsWith('/sqllab/history')) return 'query_history';
  if (pathname.startsWith('/savedqueryview/list')) return 'saved_queries';
  if (pathname === '/sqllab' || pathname.startsWith('/sqllab/'))
    return 'sqllab';
  if (pathname.startsWith('/tablemodelview/list')) return 'dataset_list';
  if (pathname.startsWith('/dataset/')) return 'dataset';
  if (pathname.startsWith('/superset/welcome/')) return 'home';
  return 'other';
}

let currentPageType: PageType | undefined;

function getOrInitPageType(): PageType {
  if (currentPageType === undefined) {
    currentPageType = derivePageType(window.location.pathname);
  }
  return currentPageType;
}

/** Called by ExtensionsStartup whenever the React Router location changes. */
export const notifyPageChange = (pathname: string): void => {
  const next = derivePageType(pathname);
  if (next === getOrInitPageType()) return;
  currentPageType = next;
  listeners.forEach(fn => fn(next));
};

const getPageType: typeof navigationApi.getPageType = () => getOrInitPageType();

const onDidChangePage: typeof navigationApi.onDidChangePage = (
  listener: (pageType: PageType) => void,
  thisArgs?: any,
): Disposable => {
  const bound = thisArgs ? listener.bind(thisArgs) : listener;
  listeners.add(bound);
  return new Disposable(() => listeners.delete(bound));
};

export const navigation: typeof navigationApi = {
  getPageType,
  onDidChangePage,
};
