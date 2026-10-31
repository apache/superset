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
 * Asserts that `element` (a list view title link or text) truncates to a
 * single line with an ellipsis instead of being hard-clipped by its cell.
 *
 * Inside a flex row the cell's own `text-overflow` no longer applies, so the
 * truncation has to come from a shrinkable flex item between `element`
 * (inclusive) and its table cell (exclusive).
 */
export function expectTruncatingTitle(element: HTMLElement) {
  const cell = element.closest('td');
  const truncating: HTMLElement[] = [];
  for (
    let node: HTMLElement | null = element;
    node && node !== cell;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (
      style.textOverflow === 'ellipsis' &&
      style.whiteSpace === 'nowrap' &&
      style.overflow === 'hidden' &&
      ['0', '0px'].includes(style.minWidth)
    ) {
      truncating.push(node);
    }
  }
  expect(truncating).not.toHaveLength(0);
}
