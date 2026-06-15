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
 * Search param codec for the TanStack router instance.
 *
 * Superset URLs carry rison payloads (e.g. ?q=(filters:!(...))) and
 * pre-encoded form_data, managed outside the router by use-query-params
 * and direct history pushes. The router must therefore treat search
 * params as opaque strings and round-trip them byte-for-byte: no JSON
 * coercion, no re-encoding surprises.
 */

export type RawSearch = Record<string, string | string[]>;

export function parseSearch(searchStr: string): RawSearch {
  const result: RawSearch = {};
  const raw = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr;
  if (!raw) return result;
  raw.split('&').forEach(pair => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      key = rawKey;
      value = rawValue;
    }
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  });
  return result;
}

// Encode only characters that are unsafe in a query string, leaving
// rison syntax characters ((),:!') readable, matching the app's existing
// `querystring.stringify(..., { encode: false })` style closely enough
// to round-trip.
function encodeQueryComponent(value: string): string {
  return value.replace(
    /[^A-Za-z0-9\-_.!~*'(),:;@$/[\]{}|^`\\]/g,
    char => {
      if (char === ' ') return '%20';
      return encodeURIComponent(char);
    },
  );
}

export function stringifySearch(search: RawSearch): string {
  const pairs: string[] = [];
  Object.entries(search).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const values = Array.isArray(value) ? value : [value];
    values.forEach(v => {
      if (v === undefined || v === null) return;
      pairs.push(
        `${encodeQueryComponent(String(key))}=${encodeQueryComponent(
          String(v),
        )}`,
      );
    });
  });
  return pairs.length ? `?${pairs.join('&')}` : '';
}

// Named aliases used by router construction sites.
export const preserveRawSearchParser = parseSearch;
export const preserveRawSearchSerializer = stringifySearch;
