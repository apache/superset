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

/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { getDefaultTooltip } from '../tooltip';
import type { Refs } from '../../types';

test('getDefaultTooltip computes height and sets scroll styles', () => {
  const refs: Refs = {
    divRef: {
      current: {
        getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      },
    },
  } as unknown as Refs;

  // Set viewport dimensions
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: 1200,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: 1000,
    configurable: true,
  });

  const tooltip = getDefaultTooltip(refs);

  // Basic defaults remain
  expect(tooltip.enterable).toBe(true);
  expect(tooltip.confine).toBe(true);
  expect(tooltip.hideDelay).toBe(50);

  // Call position to trigger runtime style application
  const tooltipDom = document.createElement('div');
  const result = tooltip.position(
    [200, 300],
    {} as any,
    tooltipDom,
    {} as any,
    { contentSize: [300, 600], viewSize: [1200, 1000] },
  );

  // Height cap: min(800px, 80vh of 1000 => 800) => 800
  expect(tooltipDom).toHaveStyle('max-height: 800px');
  expect(tooltipDom).toHaveStyle('overflow: auto');
  expect(tooltipDom).toHaveStyle('pointer-events: auto');
  // Position returns a tuple [x, y]
  expect(Array.isArray(result)).toBe(true);
  expect(result).toHaveLength(2);
});
