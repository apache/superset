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
