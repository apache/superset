import { TABS_TYPE } from './componentTypes';
import { DASHBOARD_ROOT_ID } from './constants';

export default function(layout = {}) {
  // DASHBOARD_GRID_TYPE or TABS_TYPE?
  let parent = layout[DASHBOARD_ROOT_ID];
  if (
    parent &&
    parent.children.length &&
    layout[parent.children[0]].type === TABS_TYPE
  ) {
    const tabs = layout[parent.children[0]];
    parent = layout[tabs.children[0]];
  } else {
    parent = layout[parent.children[0]];
  }

  return parent.id;
}
