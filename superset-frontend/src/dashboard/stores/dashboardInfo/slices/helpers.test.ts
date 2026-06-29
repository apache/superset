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

import { preserveScopes, nowInSeconds } from './helpers';

interface ScopedItem {
  id: string;
  chartsInScope?: number[];
  tabsInScope?: string[];
}

describe('preserveScopes', () => {
  test('carries forward scopes from existing config when incoming omits them', () => {
    const existing: ScopedItem[] = [
      { id: 'a', chartsInScope: [1, 2], tabsInScope: ['TAB-1'] },
    ];
    const incoming: ScopedItem[] = [{ id: 'a' }]; // server omits scopes

    const result = preserveScopes(existing, incoming);
    expect(result).toEqual([
      { id: 'a', chartsInScope: [1, 2], tabsInScope: ['TAB-1'] },
    ]);
  });

  test('keeps the incoming scopes when it already provides them', () => {
    const existing: ScopedItem[] = [{ id: 'a', chartsInScope: [1, 2] }];
    const incoming: ScopedItem[] = [{ id: 'a', chartsInScope: [9] }];

    expect(preserveScopes(existing, incoming)).toEqual([
      { id: 'a', chartsInScope: [9] },
    ]);
  });

  test('only carries scopes to matching ids', () => {
    const existing: ScopedItem[] = [{ id: 'a', chartsInScope: [1] }];
    const incoming: ScopedItem[] = [{ id: 'b' }];

    expect(preserveScopes(existing, incoming)).toEqual([{ id: 'b' }]);
  });

  test('filters out falsy entries from both configs', () => {
    const existing = [
      null,
      { id: 'a', chartsInScope: [1] },
    ] as unknown as ScopedItem[];
    const incoming = [undefined, { id: 'a' }] as unknown as ScopedItem[];

    expect(preserveScopes(existing, incoming)).toEqual([
      { id: 'a', chartsInScope: [1], tabsInScope: undefined },
    ]);
  });

  test('returns an empty array when both inputs are undefined', () => {
    expect(preserveScopes(undefined, undefined)).toEqual([]);
  });
});

describe('nowInSeconds', () => {
  test('returns the current time rounded to whole seconds', () => {
    const result = nowInSeconds();
    expect(Number.isInteger(result)).toBe(true);
    expect(Math.abs(result - Date.now() / 1000)).toBeLessThan(2);
  });
});
