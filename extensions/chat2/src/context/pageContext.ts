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
 * Single integration seam for the P3 namespaces.
 *
 * Each surface namespace is consumed via a try/catch — the host may ship a
 * version where a namespace function is declared but not yet implemented at
 * runtime, and the reference extension must keep working in that case. As
 * each namespace lights up on the host, that branch starts returning real
 * data without any change here.
 *
 * Route inference is the fallback when navigation.getPageType() is absent.
 */

import * as core from '@apache-superset/core';

export type PageType =
  | 'home'
  | 'dashboard'
  | 'dashboard_list'
  | 'chart'
  | 'chart_list'
  | 'sqllab'
  | 'query_history'
  | 'saved_queries'
  | 'dataset'
  | 'dataset_list'
  | 'unknown';

export interface PageContext {
  pageType: PageType;
  dashboard?: unknown;
  chart?: unknown;
  dataset?: unknown;
  sqlLab?: { tabId: string; title: string };
  href: string;
}

const tryCall = <T>(fn: () => T | undefined): T | undefined => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

const inferPageType = (pathname: string): PageType => {
  if (pathname.startsWith('/sqllab/history')) return 'query_history';
  if (pathname.startsWith('/savedqueryview/list')) return 'saved_queries';
  if (pathname.startsWith('/sqllab')) return 'sqllab';
  if (pathname.startsWith('/dashboard/list')) return 'dashboard_list';
  if (
    pathname.startsWith('/superset/dashboard') ||
    pathname.startsWith('/dashboard')
  )
    return 'dashboard';
  if (pathname.startsWith('/chart/list')) return 'chart_list';
  if (pathname.startsWith('/explore') || pathname.startsWith('/chart'))
    return 'chart';
  if (pathname.startsWith('/tablemodelview/list')) return 'dataset_list';
  if (pathname.startsWith('/tablemodelview') || pathname.startsWith('/dataset'))
    return 'dataset';
  if (pathname === '/' || pathname.startsWith('/superset/welcome'))
    return 'home';
  return 'unknown';
};

const readSqlLabTab = (): PageContext['sqlLab'] => {
  const tab = tryCall(() => (core as any).sqlLab?.getCurrentTab?.());
  return tab ? { tabId: tab.id, title: tab.title } : undefined;
};

const readPageType = (pathname: string): PageType => {
  const fromNav = tryCall(() => (core as any).navigation?.getPageType?.());
  return (fromNav as PageType | undefined) ?? inferPageType(pathname);
};

/**
 * Subscribe to page-context changes and invoke `onChange` whenever any part of
 * the context may have changed. Returns a cleanup function.
 *
 * Three classes of change are watched:
 *  - Navigation (`navigation.onDidChangePage`, or `popstate` as a fallback for
 *    hosts without the namespace) — the user moved to a different surface.
 *  - Entity hydration (`explore.onDidChangeChart`, `dashboard.onDidChangeDashboard`,
 *    `dataset.onDidChangeDataset`) — the surface's entity loaded or changed
 *    *after* navigation settled. This matters because a surface (notably Explore)
 *    can finish hydrating several seconds after the route change fires, so a
 *    navigation-only subscription would read empty entity context and never
 *    refresh once the real data arrives.
 *  - In-surface SQL Lab changes (`sqlLab.onDidChangeActiveTab`,
 *    `sqlLab.onDidChangeTabTitle`) — switching or renaming a tab does not change
 *    the route, so without these the panel would keep showing the first tab.
 */
export const subscribeToPageChanges = (onChange: () => void): (() => void) => {
  const disposers: Array<() => void> = [];

  const nav = tryCall(() => (core as any).navigation);
  if (nav?.onDidChangePage) {
    const sub = nav.onDidChangePage(onChange);
    disposers.push(() => sub.dispose());
  } else {
    window.addEventListener('popstate', onChange);
    disposers.push(() => window.removeEventListener('popstate', onChange));
  }

  // Entity-context change events. Each is optional — a host may not implement a
  // given namespace yet — so subscribe defensively and collect any disposer.
  const subscribeEntity = (
    getNamespace: () => any,
    method: string,
  ): void => {
    const sub = tryCall(() => getNamespace()?.[method]?.(onChange));
    if (sub?.dispose) {
      disposers.push(() => sub.dispose());
    }
  };
  subscribeEntity(() => (core as any).explore, 'onDidChangeChart');
  subscribeEntity(() => (core as any).dashboard, 'onDidChangeDashboard');
  subscribeEntity(() => (core as any).dataset, 'onDidChangeDataset');
  // SQL Lab tab switches/renames happen without a route change.
  subscribeEntity(() => (core as any).sqlLab, 'onDidChangeActiveTab');
  subscribeEntity(() => (core as any).sqlLab, 'onDidChangeTabTitle');

  return () => disposers.forEach(dispose => dispose());
};

export const getPageContext = (): PageContext => {
  const { pathname, href } =
    typeof window !== 'undefined'
      ? window.location
      : { pathname: '', href: '' };

  return {
    pageType: readPageType(pathname),
    dashboard: tryCall(() => (core as any).dashboard?.getCurrentDashboard?.()),
    chart: tryCall(() => (core as any).explore?.getCurrentChart?.()),
    dataset: tryCall(() => (core as any).dataset?.getCurrentDataset?.()),
    sqlLab: readSqlLabTab(),
    href,
  };
};
