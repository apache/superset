import {
  DASHBOARD_GRID_TYPE,
  DASHBOARD_HEADER_TYPE,
  DASHBOARD_ROOT_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_HEADER_ID,
  DASHBOARD_GRID_ID,
} from '../../../../src/dashboard/util/constants';

export const datasources = {};

export const sliceEntities = {};

export const charts = {};

export const dashboardInfo = {
  id: 1234,
  slug: 'dashboardSlug',
  metadata: {},
  userId: 'userId',
  dash_edit_perm: true,
  dash_save_perm: true,
  common: {
    flash_messages: [],
    conf: { ENABLE_JAVASCRIPT_CONTROLS: false, SUPERSET_WEBSERVER_TIMEOUT: 60 },
  },
};
export const dashboardState = {
  sliceIds: [],
  refresh: false,
  filters: {},
  expandedSlices: {},
  editMode: false,
  showBuilderPane: false,
  hasUnsavedChanges: false,
  maxUndoHistoryExceeded: false,
};

export const dashboardLayout = {
  past: [],
  present: {
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
      type: DASHBOARD_HEADER_TYPE,
      id: DASHBOARD_HEADER_ID,
      meta: {
        text: 'New dashboard',
      },
    },
  },
  future: [],
};

export const dashboardLayoutWithTabs = {
  past: [],
  present: {
    [DASHBOARD_ROOT_ID]: {
      type: DASHBOARD_ROOT_TYPE,
      id: DASHBOARD_ROOT_ID,
      children: ['TABS_ID'],
    },

    TABS_ID: {
      id: 'TABS_ID',
      type: TABS_TYPE,
      children: ['TAB_ID', 'TAB_ID2'],
    },

    TAB_ID: {
      id: 'TAB_ID',
      type: TAB_TYPE,
      children: [],
      meta: {
        text: 'tab',
      },
    },

    TAB_ID2: {
      id: 'TAB_ID2',
      type: TAB_TYPE,
      children: [],
      meta: {
        text: 'tab',
      },
    },

    [DASHBOARD_GRID_ID]: {
      type: DASHBOARD_GRID_TYPE,
      id: DASHBOARD_GRID_ID,
      children: [],
      meta: {},
    },

    [DASHBOARD_HEADER_ID]: {
      type: DASHBOARD_HEADER_TYPE,
      id: DASHBOARD_HEADER_ID,
      meta: {
        text: 'New dashboard',
      },
    },
  },
  future: [],
};

export const messageToasts = [];

export default {
  datasources,
  sliceEntities,
  charts,
  dashboardInfo,
  dashboardState,
  dashboardLayout,
  messageToasts,
  impressionId: 'impressionId',
};
