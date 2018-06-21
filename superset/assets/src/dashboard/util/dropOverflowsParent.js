import getComponentWidthFromDrop from './getComponentWidthFromDrop';

export default function doesChildOverflowParent(dropResult, layout) {
  const childWidth = getComponentWidthFromDrop({ dropResult, layout });
  return typeof childWidth === 'number' && childWidth < 0;
}
