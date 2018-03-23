import {
  DASHBOARD_GRID_TYPE,
  CHART_TYPE,
  COLUMN_TYPE,
  MARKDOWN_TYPE,
  TAB_TYPE,
} from './componentTypes';

const typeToWrapChildLookup = {
  [DASHBOARD_GRID_TYPE]: {
    [CHART_TYPE]: true,
    [COLUMN_TYPE]: true,
    [MARKDOWN_TYPE]: true,
  },

  [TAB_TYPE]: {
    [CHART_TYPE]: true,
    [COLUMN_TYPE]: true,
    [MARKDOWN_TYPE]: true,
  },
};

export default function shouldWrapChildInRow({ parentType, childType }) {
  if (!parentType || !childType) return false;

  const wrapChildLookup = typeToWrapChildLookup[parentType];
  if (!wrapChildLookup) return false;

  return Boolean(wrapChildLookup[childType]);
}
