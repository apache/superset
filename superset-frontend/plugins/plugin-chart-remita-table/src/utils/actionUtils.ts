import { BulkAction, RowAction, VisibilityCondition, ActionStyle } from '../types';

export const parseBulkActions = (
  splitActions: string,
  nonSplitActions: string,
): {
  split: BulkAction[];
  nonSplit: BulkAction[];
} => {
  const split = splitActions
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [key, label, boundToSelection, visibilityCondition] = line.split('|');
      return {
        key,
        label,
        type: 'dropdown' as const,
        boundToSelection: boundToSelection === 'true',
        visibilityCondition: (visibilityCondition || 'all') as VisibilityCondition,
      };
    });

  const nonSplit = nonSplitActions
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [key, label, style, boundToSelection, visibilityCondition] = line.split('|');
      return {
        key,
        label,
        type: 'button' as const,
        style: (style || 'default') as ActionStyle,
        boundToSelection: boundToSelection === 'true',
        visibilityCondition: (visibilityCondition || 'all') as VisibilityCondition,
      };
    });

  return { split, nonSplit };
};

export const parseRowActions = (actionString: string): RowAction[] => {
  if (!actionString) return [];

  return actionString
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [key, label, valueColumns, boundToSelection, visibilityCondition] = line.split('|');
      return {
        key,
        label,
        valueColumns: valueColumns ? valueColumns.split(',') : undefined,
        boundToSelection: boundToSelection === 'true',
        visibilityCondition: (visibilityCondition || 'all') as VisibilityCondition,
      };
    });
};

export const isActionVisible = (
  hasSelection: boolean,
  visibilityCondition: VisibilityCondition,
): boolean => {
  switch (visibilityCondition) {
    case 'all':
      return true;
    case 'selected':
      return hasSelection;
    case 'unselected':
      return !hasSelection;
    default:
      return true;
  }
};
