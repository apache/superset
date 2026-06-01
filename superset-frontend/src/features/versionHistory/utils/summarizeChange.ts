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
import { t } from '@apache-superset/core/translation';
import { Change } from '../types';

// Layout-record path verbs (set by ``diff_dashboard_layout`` on the
// backend): path = [verb, kind, id].
const LAYOUT_VERBS = new Set(['add', 'remove', 'move', 'edit']);

// Localized labels for the kinds emitted by the backend. Defined statically
// so xgettext can extract them.
const KIND_LABELS: Record<string, string> = {
  chart: t('chart'),
  row: t('row'),
  column: t('column'),
  tab: t('tab'),
  tabs: t('tabs'),
  header: t('header'),
  markdown: t('markdown'),
  divider: t('divider'),
  metric: t('metric'),
};

const localizedKind = (k: string): string => KIND_LABELS[k] ?? k;

// Backend column / field names → human-readable labels used in change
// summaries. Keep this list ordered roughly by frequency in real diffs
// so the most common ones are easy to spot. New entries are welcome —
// the fallback is the raw field name.
const FIELD_LABELS: Record<string, string> = {
  // Dashboard scalars
  dashboard_title: t('dashboard title'),
  description: t('description'),
  slug: t('slug'),
  css: t('CSS'),
  json_metadata: t('dashboard settings'),
  position_json: t('layout'),
  published: t('published state'),
  // Chart scalars
  slice_name: t('chart name'),
  viz_type: t('visualization type'),
  params: t('chart settings'),
  query_context: t('query'),
  cache_timeout: t('cache timeout'),
  certified_by: t('certification owner'),
  certification_details: t('certification details'),
  // Form-data fields (under params)
  metrics: t('metric'),
  groupby: t('dimension'),
  time_range: t('time range'),
  filters: t('filter'),
  adhoc_filters: t('filter'),
  row_limit: t('row limit'),
  color_scheme: t('color palette'),
  color_scheme_domain: t('color palette'),
  shared_label_colors: t('color palette'),
  label_colors: t('color palette'),
  map_label_colors: t('color palette'),
  color_namespace: t('color namespace'),
  // ``json_metadata`` substructure (Shape B leaves)
  native_filter_configuration: t('native filter'),
  defaultDataMask: t('filter default'),
  filterState: t('filter state'),
  cross_filters_chart_configuration: t('cross-filter configuration'),
  global_chart_configuration: t('chart configuration'),
  // ``position_json`` layout-meta leaves
  text: t('text'),
  markdownSource: t('markdown content'),
  background: t('background'),
  height: t('height'),
  width: t('width'),
  sliceName: t('chart name'),
  chartId: t('chart'),
  // Dataset scalars
  table_name: t('table name'),
};

// Path-prefix segments whose values aren't real field labels — e.g.
// ``json_metadata`` already has its own label, but a NESTED change at
// ``['json_metadata', 'native_filter_configuration', '<uuid>', ...]``
// should label as ``native filter`` (the meaningful prefix), not the
// random uuid at the end of the path.
const IGNORE_AS_FIELD_LABEL = new Set([
  'json_metadata',
  'position_json',
  'params',
  'query_context',
  'native_filter_configuration',
]);

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pick the most descriptive label for a Shape B path: walks from the
 * leaf backward looking for a recognized FIELD_LABELS entry. Prefers
 * "specific" segments (e.g. ``defaultDataMask``) over generic
 * path-prefix containers (``json_metadata``); falls back to a
 * path-prefix label if no specific one is found; finally falls back to
 * the raw leaf — but never to a uuid. */
function bestFieldLabel(path: string[]): string {
  if (path.length === 0) return '';
  let prefixFallback: string | null = null;
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const seg = String(path[i]);
    if (UUID_LIKE.test(seg)) continue;
    if (IGNORE_AS_FIELD_LABEL.has(seg)) {
      // Remember the first prefix label we encountered, but keep looking
      // for something more specific further forward.
      if (!prefixFallback && FIELD_LABELS[seg]) {
        prefixFallback = FIELD_LABELS[seg];
      }
      continue;
    }
    if (FIELD_LABELS[seg]) return FIELD_LABELS[seg];
  }
  if (prefixFallback) return prefixFallback;
  // Nothing recognized — return the last non-uuid segment, else the
  // raw leaf as the very last resort.
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (!UUID_LIKE.test(String(path[i]))) return String(path[i]);
  }
  return String(path[path.length - 1]);
}

export function summarizeChange(c: Change): string {
  // Layout-verb shape: ``path = [verb, kind, id, ...maybeDeeper]``. With
  // Shape B leaf-recursion an ``edit`` may extend into the layout meta
  // (e.g. ``['edit', 'chart', 'chart-1', 'meta', 'sliceName']``) — accept
  // any path length >= 3 here rather than locking to exactly 3.
  if (c.path.length >= 3 && LAYOUT_VERBS.has(String(c.path[0]))) {
    const verb = String(c.path[0]);
    const kind = localizedKind(String(c.path[1]));
    const payload =
      ((c.to_value ?? c.from_value) as { name?: string } | null) ?? null;
    const name = payload?.name;
    if (verb === 'add') {
      return name
        ? t('Added %(kind)s "%(name)s"', { kind, name })
        : t('Added %(kind)s', { kind });
    }
    if (verb === 'remove') {
      return name
        ? t('Removed %(kind)s "%(name)s"', { kind, name })
        : t('Removed %(kind)s', { kind });
    }
    if (verb === 'move') {
      return name
        ? t('Moved %(kind)s "%(name)s"', { kind, name })
        : t('Moved %(kind)s', { kind });
    }
    // ``edit`` with a deeper path — surface the most descriptive label
    // we can find walking back from the leaf (skips uuids / pure
    // path-prefix segments). Examples:
    //   ['edit', 'chart', 'chart-1', 'meta', 'sliceName'] → "chart name"
    //   ['edit', 'markdown', 'm-1', 'meta', 'markdownSource'] → "markdown content"
    if (c.path.length > 3) {
      const detail = bestFieldLabel(c.path.slice(3));
      return t('Edited %(kind)s %(detail)s', { kind, detail });
    }
    return name
      ? t('Edited %(kind)s "%(name)s"', { kind, name })
      : t('Edited %(kind)s', { kind });
  }

  const isAdd = c.from_value == null && c.to_value != null;
  const isRemove = c.from_value != null && c.to_value == null;

  // Shape A column/metric leaf — ``path = [<collection>, <name>]`` with
  // ``kind`` identifying the dataset member type. Variable-depth Shape B
  // payloads don't fall into this branch because their ``kind`` is
  // ``field``/``json``.
  if (c.path.length >= 2 && (c.kind === 'column' || c.kind === 'metric')) {
    const kind = localizedKind(c.kind);
    const name = String(c.path[c.path.length - 1]);
    if (isAdd) return t('Added %(kind)s "%(name)s"', { kind, name });
    if (isRemove) return t('Removed %(kind)s "%(name)s"', { kind, name });
    return t('Changed %(kind)s "%(name)s"', { kind, name });
  }

  if (c.path[0] === 'slices') {
    const id = String(c.path[1] ?? '');
    if (isAdd) return t('Added chart %(id)s', { id }).trim();
    if (isRemove) return t('Removed chart %(id)s', { id }).trim();
    return t('Changed chart %(id)s', { id }).trim();
  }

  if (c.kind === 'field') {
    // For Shape B nested paths (``['json_metadata', 'native_filter_configuration', '<uuid>', 'defaultDataMask', 'filterState', 'value']``)
    // a literal leaf name like ``value`` is useless; ``bestFieldLabel``
    // walks the path picking the most descriptive recognized segment.
    const fieldLabel = bestFieldLabel(c.path);
    const isShortScalar =
      c.to_value !== null &&
      c.to_value !== undefined &&
      (typeof c.to_value === 'string' ||
        typeof c.to_value === 'number' ||
        typeof c.to_value === 'boolean') &&
      String(c.to_value).length <= 80;
    if (!isAdd && !isRemove && isShortScalar) {
      return t('Changed %(field)s to "%(value)s"', {
        field: fieldLabel,
        value: String(c.to_value),
      });
    }
    if (isRemove) {
      return t('Cleared %(field)s', { field: fieldLabel });
    }
    if (isAdd && isShortScalar) {
      return t('Set %(field)s to "%(value)s"', {
        field: fieldLabel,
        value: String(c.to_value),
      });
    }
    if (isAdd) return t('Added %(field)s', { field: fieldLabel });
    return t('Changed %(field)s', { field: fieldLabel });
  }

  const kind = localizedKind(c.kind);
  if (c.path.length) {
    // ``bestFieldLabel`` so an unknown ``kind`` with a nested Shape B
    // path still surfaces a recognized prefix (e.g. ``native filter``)
    // instead of the raw leaf id.
    const detail = bestFieldLabel(c.path);
    if (isAdd) return t('Added %(kind)s %(detail)s', { kind, detail });
    if (isRemove) return t('Removed %(kind)s %(detail)s', { kind, detail });
    return t('Changed %(kind)s %(detail)s', { kind, detail });
  }
  if (isAdd) return t('Added %(kind)s', { kind });
  if (isRemove) return t('Removed %(kind)s', { kind });
  return t('Changed %(kind)s', { kind });
}
