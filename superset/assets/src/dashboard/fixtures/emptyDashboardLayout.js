import {
  DASHBOARD_GRID_TYPE,
  HEADER_TYPE,
  DASHBOARD_ROOT_TYPE,
} from '../util/componentTypes';

import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_HEADER_ID,
  DASHBOARD_GRID_ID,
} from '../util/constants';

export default {
  [DASHBOARD_ROOT_ID]: {
    type: DASHBOARD_ROOT_TYPE,
    id: DASHBOARD_ROOT_ID,
    children: [DASHBOARD_GRID_ID],
  },

  [DASHBOARD_GRID_ID]: {
    type: DASHBOARD_GRID_TYPE,
    id: DASHBOARD_GRID_ID,
    children: [],
    meta: {},
  },

  [DASHBOARD_HEADER_ID]: {
    type: HEADER_TYPE,
    id: DASHBOARD_HEADER_ID,
    meta: {
      text: 'New dashboard',
    },
  },
};
