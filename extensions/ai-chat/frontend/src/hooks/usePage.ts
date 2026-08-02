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
import { useEffect, useState } from 'react';
import { navigation, translation } from '@apache-superset/core';
import { getCachedResourceName } from '../api/resourceName';
import type { Page, PageContext, ResourceContext } from '../types';

const { t } = translation;

/** Current page type, via the public navigation API */
export function usePage(): Page {
  const [page, setPage] = useState<Page>(() => navigation.getPage());
  useEffect(() => {
    const { dispose } = navigation.onDidChangePage(next => setPage(next));
    return () => {
      dispose();
    };
  }, []);
  return page;
}

// Matches the SPA route (/dashboard/<id_or_slug>/) and the legacy server
// route (/superset/dashboard/<id_or_slug>/). `list` and `new` are sibling
// routes rather than slugs, so excluding them stops /dashboard/list/ from
// reading as a dashboard with the slug "list"
const DASHBOARD_PATH = /^\/(?:superset\/)?dashboard\/(?!list\b|new\b)([\w-]+)/;
const NUMERIC_ID = /^\d+$/;

/**
 * The entity in view, parsed from the URL. The id is a hint only, which the
 * assistant verifies with tools before relying on it.
 *
 * URL parsing is a shim: the public `navigation` namespace exposes the page
 * surface and defers entity-level context to surface-specific namespaces.
 * Once that API reports the active entity, this is the only place to change.
 */
export function currentResource(page: Page): ResourceContext | null {
  if (page === 'dashboard') {
    const match = DASHBOARD_PATH.exec(window.location.pathname);
    if (match) {
      return { kind: 'dashboard', id_or_slug: match[1] };
    }
  } else if (page === 'explore') {
    const sliceId = new URLSearchParams(window.location.search).get('slice_id');
    if (sliceId && NUMERIC_ID.test(sliceId)) {
      return { kind: 'chart', id_or_slug: sliceId };
    }
  }
  return null;
}

export function buildPageContext(
  page: Page,
  references: ResourceContext[] = [],
): PageContext {
  const context: PageContext = { page };
  const resource = currentResource(page);
  if (resource) {
    // The name is included only once resolved, so a turn sent right after
    // landing still carries the id and omits the name
    const name = getCachedResourceName(resource);
    context.resource = name ? { ...resource, name } : resource;
  }
  // Objects the user attached by dragging them in. They are sent every turn
  // because they stay attached until removed.
  if (references.length) context.references = references;
  return context;
}

export function pageLabel(page: Page): string {
  const labels: Record<Page, string> = {
    dashboard: t('Dashboard'),
    dashboard_list: t('Dashboards'),
    explore: t('Explore'),
    chart_list: t('Charts'),
    sqllab: t('SQL Lab'),
    query_history: t('Query history'),
    saved_queries: t('Saved queries'),
    dataset: t('Dataset'),
    dataset_list: t('Datasets'),
    home: t('Home'),
  };
  return labels[page] || page;
}
