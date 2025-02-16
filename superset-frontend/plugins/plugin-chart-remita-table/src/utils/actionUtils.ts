import {  VisibilityCondition } from '../types';

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
