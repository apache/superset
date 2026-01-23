import type { Layout } from 'src/dashboard/types';
import type { DropResult } from './dnd-reorder';
import getComponentWidthFromDrop from './getComponentWidthFromDrop';

export default function doesChildOverflowParent(
  dropResult: DropResult,
  layout: Layout,
): boolean {
  const childWidth = getComponentWidthFromDrop({ dropResult, layout });

  if (typeof childWidth !== 'number') return false;
  return childWidth < 0;
}
