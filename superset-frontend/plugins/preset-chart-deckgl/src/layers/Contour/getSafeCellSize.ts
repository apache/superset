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
export const MIN_CELL_SIZE = 10;
export const MAX_CELL_SIZE = 5000;
export const MAX_GRID_CELLS = 1_000_000;

export function getSafeCellSize({
  cellSize,
  viewport,
  onAutoAdjust,
}: {
  cellSize?: string | number;
  viewport?: { width?: number; height?: number };
  onAutoAdjust?: (info: {
    original: number;
    adjusted: number;
    estimatedCells: number;
  }) => void;
}) {
  let parsedCellSize = Number(cellSize ?? 200);
  if (!Number.isFinite(parsedCellSize)) {
    parsedCellSize = 200;
  }

  let safeCellSize = Math.min(
    MAX_CELL_SIZE,
    Math.max(MIN_CELL_SIZE, parsedCellSize),
  );

  if (
    viewport &&
    typeof viewport.width === 'number' &&
    typeof viewport.height === 'number' &&
    viewport.width > 0 &&
    viewport.height > 0
  ) {
    const estimatedCells =
      (viewport.width / safeCellSize) * (viewport.height / safeCellSize);

    if (estimatedCells > MAX_GRID_CELLS) {
      const scaleFactor = Math.sqrt(estimatedCells / MAX_GRID_CELLS);
      const adjustedCellSize = Math.ceil(safeCellSize * scaleFactor);

      const finalSize = Math.min(MAX_CELL_SIZE, adjustedCellSize);

      onAutoAdjust?.({
        original: safeCellSize,
        adjusted: finalSize,
        estimatedCells,
      });

      safeCellSize = finalSize;
    }
  }

  return safeCellSize;
}
