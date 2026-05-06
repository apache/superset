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
import { isProbablyHTML, sanitizeHtml } from '@superset-ui/core';
import { ValueGetterParams } from '@superset-ui/core/components/ThemedAgGridReact';

// Cache extracted text by raw HTML string. Sort comparators run O(n log n)
// times against the same set of cell values, so reparsing on every call is
// a measurable cost on large tables. Bounded by the number of unique HTML
// values in the dataset.
const htmlTextCache = new Map<string, string>();

const stripHtmlToText = (html: string): string => {
  const cached = htmlTextCache.get(html);
  if (cached !== undefined) return cached;
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html');
  const text = (doc.body.textContent || '').trim();
  htmlTextCache.set(html, text);
  return text;
};

/**
 * Returns the visible-text representation of an HTML cell value so AG Grid
 * filters and sort operate on what the user sees, not the underlying markup.
 * Pass-through for non-HTML values.
 */
const htmlTextFilterValueGetter = (params: ValueGetterParams) => {
  const raw = params.data?.[params.colDef.field as string];
  if (typeof raw === 'string' && isProbablyHTML(raw)) {
    return stripHtmlToText(raw);
  }
  return raw;
};

/**
 * Comparator that mirrors AG Grid's default string comparator (codepoint
 * order, nulls first), but extracts visible text from HTML values first
 * so HTML cells sort by their displayed label. Plain (non-HTML) values
 * pass through unchanged, preserving default ordering — e.g. 'Z' still
 * sorts before 'a' as it does under the default comparator.
 */
export const htmlTextComparator = (a: unknown, b: unknown): number => {
  const toText = (v: unknown) =>
    typeof v === 'string' && isProbablyHTML(v) ? stripHtmlToText(v) : v;
  const aT = toText(a);
  const bT = toText(b);
  if (aT == null && bT == null) return 0;
  if (aT == null) return -1;
  if (bT == null) return 1;
  if (typeof aT === 'number' && typeof bT === 'number') return aT - bT;
  if (aT === bT) return 0;
  return aT < bT ? -1 : 1;
};

export default htmlTextFilterValueGetter;
