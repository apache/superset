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
  getColumnSpec,
  type ColumnLayout,
} from '@superset-ui/core/components/TableCollection';

/**
 * jsdom has no layout, so list view tables can't measure their container.
 * Pins every element's measured width so managed column widths resolve
 * against `width`. Call before rendering; restored by `jest.restoreAllMocks`.
 */
export function mockListViewContainerWidth(width: number) {
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width } as DOMRect);
}

/**
 * Asserts that every rendered column of a list view `table` has a pixel width
 * within the bounds of its expected layout, and that the widths fill
 * `containerWidth`.
 */
export function expectColumnWidthsWithinLayouts(
  table: HTMLElement,
  expectedLayouts: Record<string, ColumnLayout>,
  containerWidth: number,
) {
  const headers = Array.from(table.querySelectorAll('thead th')).map(
    th => th.textContent?.trim() ?? '',
  );
  const widths = Array.from(table.querySelectorAll('colgroup col')).map(col =>
    parseInt((col as HTMLElement).style.width, 10),
  );
  expect(headers).toEqual(Object.keys(expectedLayouts));
  expect(widths).toHaveLength(headers.length);

  headers.forEach((header, index) => {
    const { min, max } = getColumnSpec(expectedLayouts[header]);
    const width = widths[index];
    expect({ header, withinLayout: width >= min && width <= max }).toEqual({
      header,
      withinLayout: true,
    });
  });
  expect(widths.reduce((total, width) => total + width, 0)).toBe(
    containerWidth,
  );
}
