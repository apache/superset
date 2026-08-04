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

import { render, screen } from 'spec/helpers/testing-library';
import type { QueryData } from '@superset-ui/core';
import { ChartPills } from './ChartPills';

jest.mock('@superset-ui/core/components', () => ({
  CachedLabel: ({ cacheSource }: { cacheSource?: string }) => (
    <span data-test="cached-label">
      {cacheSource === 'semantic' ? 'Semantic cache' : 'Ordinary cache'}
    </span>
  ),
  Timer: () => <span data-test="timer" />,
}));

const response = (semanticCacheHit: boolean, isCached = true): QueryData =>
  ({
    is_cached: isCached,
    semantic_cache_hit: semanticCacheHit,
  }) as QueryData;

test('passes semantic cache source to the cached label', () => {
  render(
    <ChartPills
      queriesResponse={[response(true)]}
      chartUpdateStartTime={0}
      refreshCachedQuery={jest.fn()}
      hideRowCount
    />,
  );

  expect(screen.getByTestId('cached-label')).toHaveTextContent(
    'Semantic cache',
  );
});

test('keeps ordinary cache source distinct', () => {
  render(
    <ChartPills
      queriesResponse={[response(false)]}
      chartUpdateStartTime={0}
      refreshCachedQuery={jest.fn()}
      hideRowCount
    />,
  );

  expect(screen.getByTestId('cached-label')).toHaveTextContent(
    'Ordinary cache',
  );
});

test('shows the cache label for a direct semantic cache hit', () => {
  render(
    <ChartPills
      queriesResponse={[response(true, false)]}
      chartUpdateStartTime={0}
      refreshCachedQuery={jest.fn()}
      hideRowCount
    />,
  );

  expect(screen.getByTestId('cached-label')).toHaveTextContent(
    'Semantic cache',
  );
});
