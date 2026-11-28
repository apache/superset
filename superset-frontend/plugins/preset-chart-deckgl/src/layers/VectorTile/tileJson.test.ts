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
  getTileJsonProperties,
  isHttpUrl,
  isNumericTileType,
} from './tileJson';

const tileJson = {
  vector_layers: [
    { id: 'places', fields: { name: 'text', visitors: 'int4' } },
    { id: 'roads', fields: { name: 'text', lanes: 'int2' } },
  ],
};

test('lists only the source layer fields when a source layer is given', () => {
  expect(getTileJsonProperties(tileJson, 'places')).toEqual([
    { name: 'name', type: 'text' },
    { name: 'visitors', type: 'int4' },
  ]);
});

test('merges and sorts fields from every layer when no source layer is given', () => {
  expect(getTileJsonProperties(tileJson).map(p => p.name)).toEqual([
    'lanes',
    'name',
    'visitors',
  ]);
});

test('throws when the source layer is missing', () => {
  expect(() => getTileJsonProperties(tileJson, 'nope')).toThrow('nope');
});

test('throws when the document has no vector_layers', () => {
  expect(() => getTileJsonProperties({ tiles: [] })).toThrow();
});

test('recognises numeric tile types from different servers', () => {
  ['int4', 'numeric', 'float8', 'Number', undefined].forEach(type =>
    expect(isNumericTileType(type)).toBe(true),
  );
  ['text', 'String', 'Boolean'].forEach(type =>
    expect(isNumericTileType(type)).toBe(false),
  );
});

test.each([
  ['http://tiles.example.com/x.json', true],
  ['https://tiles.example.com/x.json', true],
  // eslint-disable-next-line no-script-url -- checks that script URLs are rejected
  ['javascript:alert(1)', false],
  ['file:///etc/passwd', false],
  ['not a url', false],
])('isHttpUrl(%s) is %s', (url, expected) => {
  expect(isHttpUrl(url)).toBe(expected);
});
