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
 * Superset objects the user drags into the chat.
 *
 * Chart titles, dashboard cards and dataset links are ordinary anchors, and
 * browsers hand a dragged anchor to the drop target as its URL. Reading the
 * identity back out of that URL means dragging works without the host
 * needing a drag source of its own.
 *
 * The identifier is a hint, exactly like the one parsed for page context:
 * the assistant verifies it with a tool before acting on it.
 */
import type { ResourceContext } from '../types';

/** Sticky context stays small, both for the prompt and for the header. */
export const MAX_REFERENCES = 5;

// Matches the SPA route (/dashboard/<id_or_slug>/) and the legacy server
// route (/superset/dashboard/<id_or_slug>/), excluding the sibling routes
// that are not slugs.
const DASHBOARD_PATH = /^\/(?:superset\/)?dashboard\/(?!list\b|new\b)([\w-]+)/;
const EXPLORE_PATH = /^\/(?:superset\/)?explore\b/;
const NUMERIC_ID = /^\d+$/;
// Explore's legacy combined form: datasource=<id>__<type>
const DATASOURCE_PAIR = /^(\d+)__\w+$/;

/** Stable identity of a reference, used for keys and for de-duplication. */
export function referenceKey(reference: ResourceContext): string {
  return `${reference.kind}:${reference.id_or_slug}`;
}

function fromExplore(url: URL): ResourceContext | null {
  const params = url.searchParams;
  const sliceId = params.get('slice_id');
  if (sliceId && NUMERIC_ID.test(sliceId)) {
    return { kind: 'chart', id_or_slug: sliceId };
  }
  // A dataset opened in Explore has no chart yet, only its datasource.
  const datasourceId = params.get('datasource_id');
  if (
    datasourceId &&
    NUMERIC_ID.test(datasourceId) &&
    (params.get('datasource_type') || 'table') === 'table'
  ) {
    return { kind: 'dataset', id_or_slug: datasourceId };
  }
  const pair = DATASOURCE_PAIR.exec(params.get('datasource') || '');
  return pair ? { kind: 'dataset', id_or_slug: pair[1] } : null;
}

/**
 * The Superset object a dropped URL points at, or null when it points at
 * something else.
 *
 * Only same-origin URLs are read: a link dragged from another site names
 * nothing in this Superset, and following it into the prompt would let an
 * unrelated page choose the assistant's context.
 */
export function parseEntityUrl(raw: string): ResourceContext | null {
  // A uri-list drop can carry several lines, the first being the URL and the
  // rest comments; a plain-text drop is usually the bare URL.
  const candidate = raw
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#'));
  if (!candidate) return null;

  let url: URL;
  try {
    url = new URL(candidate, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;

  const dashboard = DASHBOARD_PATH.exec(url.pathname);
  if (dashboard) return { kind: 'dashboard', id_or_slug: dashboard[1] };
  if (EXPLORE_PATH.test(url.pathname)) return fromExplore(url);
  return null;
}

/**
 * Where a reference points, in the same form Superset's own models build, so
 * a tag in the transcript opens what the user dropped. Kept as a path so the
 * link can only lead back into this instance.
 *
 * `parseEntityUrl` reads these back, which is what the round-trip test pins:
 * a reference that could be attached is a reference that can be opened.
 */
export function entityHref(reference: ResourceContext): string {
  const id = encodeURIComponent(reference.id_or_slug);
  switch (reference.kind) {
    case 'dashboard':
      return `/dashboard/${id}/`;
    case 'chart':
      return `/explore/?slice_id=${id}`;
    // Only table datasources are ever parsed into a reference.
    default:
      return `/explore/?datasource_type=table&datasource_id=${id}`;
  }
}

/** The URL text a drop carries, in the order browsers prefer. */
export function droppedText(transfer: DataTransfer | null): string {
  if (!transfer) return '';
  return transfer.getData('text/uri-list') || transfer.getData('text/plain');
}
