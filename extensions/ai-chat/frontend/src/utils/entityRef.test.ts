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
import {
  droppedText,
  entityHref,
  parseEntityUrl,
  referenceKey,
} from './entityRef';

test('a chart title dragged from a dashboard names its chart', () => {
  // The href Superset renders on a dashboard chart header.
  expect(
    parseEntityUrl('/explore/?dashboard_page_id=rQ69efz&slice_id=100'),
  ).toEqual({ kind: 'chart', id_or_slug: '100' });
});

test('both dashboard routes are recognised, by id or slug', () => {
  expect(parseEntityUrl('/superset/dashboard/world_health/')).toEqual({
    kind: 'dashboard',
    id_or_slug: 'world_health',
  });
  // Absolute, as a browser hands over a dragged anchor.
  expect(parseEntityUrl(`${window.location.origin}/dashboard/5/`)).toEqual({
    kind: 'dashboard',
    id_or_slug: '5',
  });
});

test('list and new are routes, not dashboards', () => {
  expect(parseEntityUrl('/dashboard/list/')).toBeNull();
  expect(parseEntityUrl('/dashboard/new/')).toBeNull();
});

test('a dataset opened in Explore names the dataset', () => {
  expect(
    parseEntityUrl('/explore/?datasource_id=42&datasource_type=table'),
  ).toEqual({ kind: 'dataset', id_or_slug: '42' });
  expect(parseEntityUrl('/explore/?datasource=42__table')).toEqual({
    kind: 'dataset',
    id_or_slug: '42',
  });
});

test('a link to another host is never read', () => {
  expect(parseEntityUrl('https://evil.example/dashboard/5/')).toBeNull();
});

test('anything that is not a Superset object is refused', () => {
  expect(parseEntityUrl('/sqllab')).toBeNull();
  expect(parseEntityUrl('just some text')).toBeNull();
  expect(parseEntityUrl('')).toBeNull();
});

test('a uri-list drop uses its first real line', () => {
  expect(parseEntityUrl('# comment\n/dashboard/7/\n/dashboard/8/')).toEqual({
    kind: 'dashboard',
    id_or_slug: '7',
  });
});

test('references are keyed by kind and id', () => {
  expect(referenceKey({ kind: 'chart', id_or_slug: '100' })).toBe('chart:100');
});

test('every reference links back to what it names', () => {
  const references = [
    { kind: 'dashboard', id_or_slug: 'world_health' },
    { kind: 'dashboard', id_or_slug: '5' },
    { kind: 'chart', id_or_slug: '100' },
    { kind: 'dataset', id_or_slug: '42' },
  ] as const;
  // Whatever could be attached can be opened: the link parses back to it.
  references.forEach(reference =>
    expect(parseEntityUrl(entityHref(reference))).toEqual(reference),
  );
  expect(entityHref(references[0])).toBe('/dashboard/world_health/');
  expect(entityHref(references[2])).toBe('/explore/?slice_id=100');
});

test('a slug is escaped rather than trusted into the link', () => {
  expect(entityHref({ kind: 'dashboard', id_or_slug: '../../evil?x=1' })).toBe(
    '/dashboard/..%2F..%2Fevil%3Fx%3D1/',
  );
});

test('a drop prefers the uri-list flavour over plain text', () => {
  const transfer = {
    getData: (type: string) =>
      type === 'text/uri-list' ? '/dashboard/5/' : 'some label',
  } as DataTransfer;
  expect(droppedText(transfer)).toBe('/dashboard/5/');
  expect(droppedText(null)).toBe('');
});
