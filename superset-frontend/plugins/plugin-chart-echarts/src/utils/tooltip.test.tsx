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
import React from 'react';
import { getDefaultTooltip } from './tooltip';
import type { Refs } from '../types';

test('getDefaultTooltip computes height and sets scroll styles', () => {
  const div = document.createElement('div');
  jest.spyOn(div, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    top: 0,
    right: 100,
    bottom: 100,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect);

  const divRef = React.createRef<HTMLDivElement>();
  Object.defineProperty(divRef, 'current', { value: div });

  const refs: Refs = { divRef };

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

  // Test behavioral properties
  expect(tooltip.enterable).toBe(true);
  expect(tooltip.confine).toBe(true);
  expect(tooltip.hideDelay).toBe(50);

  // Test that position function exists and is callable
  expect(typeof tooltip.position).toBe('function');

  // Test position function behavior - returns coordinates
  const tooltipDom = document.createElement('div');
  const result = tooltip.position(
    [200, 300],
    {} as any,
    tooltipDom,
    {} as any,
    { contentSize: [300, 600], viewSize: [1200, 1000] },
  );

  // Verify position returns coordinate tuple
  expect(Array.isArray(result)).toBe(true);
  expect(result).toHaveLength(2);
  expect(typeof result[0]).toBe('number');
  expect(typeof result[1]).toBe('number');

  const computedMaxHeight = parseInt(tooltipDom.style.maxHeight, 10);
  const viewportHeight = 1000;
  const expectedMaxHeight = Math.min(800, viewportHeight * 0.8);

  expect(computedMaxHeight).toBe(expectedMaxHeight);
  expect(tooltipDom).toHaveStyle({ overflow: 'auto' });
});
