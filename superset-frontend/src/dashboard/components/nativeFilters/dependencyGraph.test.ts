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
import { resolveTransitiveChildIds } from './dependencyGraph';

test('resolveTransitiveChildIds returns empty for a filter with no children', () => {
  expect(
    resolveTransitiveChildIds('A', {
      A: { cascadeParentIds: [] },
    }),
  ).toEqual([]);
});

test('resolveTransitiveChildIds returns direct children', () => {
  const result = resolveTransitiveChildIds('A', {
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['A'] },
  });
  // Breadth-first: direct children before grandchildren.
  expect(result).toEqual(['B', 'C']);
});

test('resolveTransitiveChildIds walks a linear chain A -> B -> C -> D', () => {
  // D depends on C, C on B, B on A.
  const result = resolveTransitiveChildIds('A', {
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['B'] },
    D: { cascadeParentIds: ['C'] },
  });
  // Breadth-first: B (direct child) before C, then D.
  expect(result).toEqual(['B', 'C', 'D']);
});

test('resolveTransitiveChildIds deduplicates shared descendants in a diamond', () => {
  //      A
  //    /  \
  //   B    C
  //    \  /
  //     D
  const result = resolveTransitiveChildIds('A', {
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['A'] },
    D: { cascadeParentIds: ['B', 'C'] },
  });
  expect(result).toEqual(['B', 'C', 'D']);
});

test('resolveTransitiveChildIds collects descendants for a mid-chain filter', () => {
  // Given B below, descendants of B are D (and any deeper nodes).
  const result = resolveTransitiveChildIds('B', {
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['A'] },
    D: { cascadeParentIds: ['B'] },
  });
  expect(result).toEqual(['D']);
});

test('resolveTransitiveChildIds defends against cyclic configuration', () => {
  const result = resolveTransitiveChildIds('A', {
    A: { cascadeParentIds: ['B'] },
    B: { cascadeParentIds: ['A'] },
  });
  expect(result).toEqual(['B']);
});

test('resolveTransitiveChildIds only includes filters that list the parent', () => {
  // Filters that do not declare a dependency should not be considered
  // descendants even though they reference the same columns.
  const result = resolveTransitiveChildIds('A', {
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: [] },
  });
  expect(result).toEqual(['B']);
});
