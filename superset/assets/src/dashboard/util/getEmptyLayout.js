import { DASHBOARD_ROOT_TYPE, DASHBOARD_GRID_TYPE } from './componentTypes';

import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
  DASHBOARD_VERSION_KEY,
} from './constants';

export default function() {
  return {
    [DASHBOARD_VERSION_KEY]: 'v2',
    [DASHBOARD_ROOT_ID]: {
      type: DASHBOARD_ROOT_TYPE,
      id: DASHBOARD_ROOT_ID,
      children: [DASHBOARD_GRID_ID],
    },
    [DASHBOARD_GRID_ID]: {
      type: DASHBOARD_GRID_TYPE,
      id: DASHBOARD_GRID_ID,
      children: [],
    },
  };
}
