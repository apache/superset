// DODO was here
// DODO created 45525377
import { DataColumnMeta } from '../../types';

export const getDefaultPinColumns = (columns: DataColumnMeta[]) => {
  const result: number[] = [];
  columns.forEach((item, index) => {
    if (item.config?.pinColumn) {
      result.push(index);
    }
  });

  return result;
};

export const getPinnedWidth = (
  colWidths: number[],
  pinnedColumns: number[],
  columnIndex: number,
): number => {
  if (columnIndex === 0 || pinnedColumns.length === 1) return 0;

  let left = 0;

  for (let i = 0; i < pinnedColumns.length; i += 1) {
    const index = pinnedColumns[i];
    if (index === columnIndex) break;
    const columnWidth = colWidths[index];
    left += columnWidth;
  }

  return left;
};
