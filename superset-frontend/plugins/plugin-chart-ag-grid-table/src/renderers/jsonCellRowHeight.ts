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

type HeightRow = {
  setRowHeight?: (height: number | null | undefined) => void;
};

const heightsByRow = new WeakMap<object, Map<string, number>>();

/**
 * Track per-column JSON expansion height on a row. `row` is the AG Grid row
 * node: height is applied with `row.setRowHeight`, so the method keeps that
 * node as `this`. The row grows to the tallest expanded JSON cell and returns
 * to the grid default once every expanded cell in that row is collapsed. A
 * collapse for a column that was never expanded is ignored.
 */
export function syncJsonCellRowHeight(
  row: HeightRow,
  onRowHeightChanged: () => void,
  colId: string,
  height: number,
): void {
  let heights = heightsByRow.get(row);
  const hadEntry = heights?.has(colId) ?? false;
  if (height <= 0 && !hadEntry) {
    return;
  }
  if (!heights) {
    heights = new Map();
    heightsByRow.set(row, heights);
  }
  if (height > 0) {
    heights.set(colId, height);
  } else {
    heights.delete(colId);
  }
  let max = 0;
  heights.forEach(value => {
    if (value > max) {
      max = value;
    }
  });
  row.setRowHeight?.(max > 0 ? max : null);
  onRowHeightChanged();
}
