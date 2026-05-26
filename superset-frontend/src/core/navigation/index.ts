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
type PageContext = navigationApi.PageContext;

const listeners = new Set<(ctx: PageContext) => void>();

function derivePageType(pathname: string): PageType {
  if (pathname.startsWith('/superset/dashboard/')) return 'dashboard';
  if (pathname.startsWith('/explore/')) return 'explore';
  if (pathname.startsWith('/superset/explore/')) return 'explore';
  if (pathname.startsWith('/chart/add')) return 'explore';
  if (pathname.startsWith('/sqllab/')) return 'sqllab';
  if (pathname.startsWith('/dataset/')) return 'dataset';
  if (pathname.startsWith('/superset/welcome/')) return 'home';
  return 'other';
}

function extractEntityId(pathname: string, pageType: PageType): number | null {
  if (pageType === 'dashboard') {
    const m = pathname.match(/\/superset\/dashboard\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  if (pageType === 'dataset') {
    const m = pathname.match(/\/dataset\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  return null;
}

let currentContext: PageContext = {
  pageType: derivePageType(window.location.pathname),
  entityId: null,
};
currentContext.entityId = extractEntityId(
  window.location.pathname,
  currentContext.pageType,
);

/** Called by ExtensionsStartup whenever the React Router location changes. */
export const notifyPageChange = (pathname: string): void => {
  const pageType = derivePageType(pathname);
  const entityId = extractEntityId(pathname, pageType);
  const next: PageContext = { pageType, entityId };
  if (
    next.pageType === currentContext.pageType &&
    next.entityId === currentContext.entityId
  ) {
    return;
  }
  currentContext = next;
  listeners.forEach(fn => fn(next));
};

const getPageType: typeof navigationApi.getPageType = () =>
  currentContext.pageType;

const getCurrentPage: typeof navigationApi.getCurrentPage = () => ({
  ...currentContext,
});

const onDidChangePage: typeof navigationApi.onDidChangePage = (
  listener: (ctx: PageContext) => void,
  thisArgs?: any,
): Disposable => {
  const bound = thisArgs ? listener.bind(thisArgs) : listener;
  listeners.add(bound);
  return new Disposable(() => listeners.delete(bound));
};

export const navigation: typeof navigationApi = {
  getPageType,
  getCurrentPage,
  onDidChangePage,
};
