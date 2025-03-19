// DODO was here

import { Layout } from 'src/dashboard/types';
import { ChartState } from 'src/explore/types';

interface DashboardInfo {
  id: number;
  userId: string | undefined;
  dash_edit_perm: boolean;
  dash_save_perm: boolean;
  metadata?: Record<string, any>;
  common?: { conf: Record<string, any> };
}

interface HeaderDropdownPropsDodoExtended {
  dashboardTitleRU: string; // DODO added 44120742
}
export interface HeaderDropdownProps extends HeaderDropdownPropsDodoExtended {
  addSuccessToast: () => void;
  addDangerToast: () => void;
  customCss: string;
  colorNamespace?: string;
  colorScheme?: string;
  dashboardId: number;
  dashboardInfo: DashboardInfo;
  dashboardTitle: string;
  editMode: boolean;
  expandedSlices: Record<number, boolean>;
  forceRefreshAllCharts: () => void;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  layout: Layout;
  onChange: () => void;
  onSave: () => void;
  refreshFrequency: number;
  setRefreshFrequency: () => void;
  shouldPersistRefreshFrequency: boolean;
  showPropertiesModal: () => void;
  startPeriodicRender: () => void;
  updateCss: () => void;
  userCanEdit: boolean;
  userCanSave: boolean;
  userCanShare: boolean;
  userCanCurate: boolean;
  isDropdownVisible: boolean;
  manageEmbedded: () => void;
  dataMask: any;
  lastModifiedTime: number;
  logEvent: () => void;
}

interface HeaderPropsDodoExtended {
  dashboardTitleRU: string; // DODO added 44120742
}
export interface HeaderProps extends HeaderPropsDodoExtended {
  addSuccessToast: () => void;
  addDangerToast: () => void;
  addWarningToast: () => void;
  colorNamespace?: string;
  charts: ChartState | {};
  colorScheme?: string;
  customCss: string;
  user: Object | undefined;
  dashboardInfo: DashboardInfo;
  dashboardTitle: string;
  setColorScheme: () => void;
  setUnsavedChanges: () => void;
  isStarred: boolean;
  isPublished: boolean;
  onChange: () => void;
  onSave: () => void;
  fetchFaveStar: () => void;
  saveFaveStar: () => void;
  savePublished: () => void;
  updateDashboardTitle: () => void;
  editMode: boolean;
  setEditMode: () => void;
  showBuilderPane: () => void;
  updateCss: () => void;
  logEvent: () => void;
  hasUnsavedChanges: boolean;
  maxUndoHistoryExceeded: boolean;
  lastModifiedTime: number;
  onUndo: () => void;
  onRedo: () => void;
  onRefresh: () => void;
  undoLength: number;
  redoLength: number;
  setMaxUndoHistoryExceeded: () => void;
  maxUndoHistoryToast: () => void;
  refreshFrequency: number;
  shouldPersistRefreshFrequency: boolean;
  setRefreshFrequency: () => void;
  dashboardInfoChanged: () => void;
  dashboardTitleChanged: () => void;
}
