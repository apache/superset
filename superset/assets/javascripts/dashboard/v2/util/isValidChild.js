import {
  CHART_TYPE,
  COLUMN_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  SPACER_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from './componentTypes';

const typeToValidChildType = {
  [DASHBOARD_ROOT_TYPE]: {
    [TABS_TYPE]: true,
    [DASHBOARD_GRID_TYPE]: true,
  },

  [DASHBOARD_GRID_TYPE]: {
    [CHART_TYPE]: true,
    [COLUMN_TYPE]: true,
    [DIVIDER_TYPE]: true,
    [HEADER_TYPE]: true,
    [ROW_TYPE]: true,
    [SPACER_TYPE]: true,
    [TABS_TYPE]: true,
  },

  [ROW_TYPE]: {
    [CHART_TYPE]: true,
    [MARKDOWN_TYPE]: true,
    [COLUMN_TYPE]: true,
    [SPACER_TYPE]: true,
  },

  [TABS_TYPE]: {
    [TAB_TYPE]: true,
  },

  [TAB_TYPE]: {
    [CHART_TYPE]: true,
    [COLUMN_TYPE]: true,
    [DIVIDER_TYPE]: true,
    [HEADER_TYPE]: true,
    [ROW_TYPE]: true,
    [SPACER_TYPE]: true,
    [TABS_TYPE]: true,
  },

  [COLUMN_TYPE]: {
    [CHART_TYPE]: true,
    [HEADER_TYPE]: true,
    [MARKDOWN_TYPE]: true,
    [ROW_TYPE]: true,
    [SPACER_TYPE]: true,
  },

  // these have no valid children
  [CHART_TYPE]: {},
  [DIVIDER_TYPE]: {},
  [HEADER_TYPE]: {},
  [MARKDOWN_TYPE]: {},
  [SPACER_TYPE]: {},
};

export default function isValidChild({ parentType, childType }) {
  if (!parentType || !childType) return false;

  const isValid = Boolean(
    typeToValidChildType[parentType][childType],
  );

  return isValid;
}
