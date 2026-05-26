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
  | 'chart'
  | 'sqllab'
  | 'dataset'
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
  if (pathname.startsWith('/sqllab')) return 'sqllab';
  if (
    pathname.startsWith('/superset/dashboard') ||
    pathname.startsWith('/dashboard')
  )
    return 'dashboard';
  if (pathname.startsWith('/explore') || pathname.startsWith('/chart'))
    return 'chart';
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
 * Subscribe to page changes. Uses navigation.onDidChangePage when available,
 * falls back to popstate for hosts without the navigation namespace.
 * Returns a cleanup function.
 */
export const subscribeToPageChanges = (onChange: () => void): (() => void) => {
  const nav = tryCall(() => (core as any).navigation);
  if (nav?.onDidChangePage) {
    const sub = nav.onDidChangePage(onChange);
    return () => sub.dispose();
  }
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
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
