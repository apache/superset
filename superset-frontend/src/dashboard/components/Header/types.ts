/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { DataMaskStateWithId, JsonObject } from '@superset-ui/core';
import { Layout } from 'src/dashboard/types';
import { ChartState } from 'src/explore/types';
import { AlertObject } from 'src/features/alerts/types';
import { ToastMeta } from 'src/components/MessageToasts/types';
import { TagType } from 'src/components/Tag/TagType';
import Owner from 'src/types/Owner';
import Role from 'src/types/Role';

interface DashboardInfo {
  id: number;
  userId?: string;
  dash_edit_perm: boolean;
  dash_save_perm?: boolean;
  dash_share_perm?: boolean;
  is_managed_externally?: boolean;
  slug?: string;
  last_modified_time?: number;
  certified_by?: string;
  certification_details?: string;
  owners?: Owner[];
  roles?: Role[];
  tags?: TagType[];
  metadata?: JsonObject & {
    timed_refresh_immune_slices?: number[];
    refresh_frequency?: number;
  };
  common?: { conf: JsonObject };
  theme?: {
    id: number;
    name: string;
  } | null;
}

type ToastOptions = Partial<Omit<ToastMeta, 'id' | 'toastType' | 'text'>>;

export interface HeaderDropdownProps {
  addSuccessToast: (msg: string, options?: ToastOptions) => void;
  addDangerToast: (msg: string, options?: ToastOptions) => void;
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
  onSave: () => void;
  refreshFrequency: number;
  shouldPersistRefreshFrequency: boolean;
  showPropertiesModal: () => void;
  showRefreshModal: () => void;
  userCanEdit: boolean;
  userCanSave: boolean;
  userCanShare: boolean;
  userCanCurate: boolean;
  manageEmbedded: () => void;
  dataMask?: DataMaskStateWithId;
  lastModifiedTime: number;
  logEvent: (eventName: string, eventData: JsonObject) => void;
  refreshLimit?: number;
  refreshWarning?: string;
  directPathToChild?: string[];
  showReportModal: () => void;
  setCurrentReportDeleting: (alert: AlertObject | null) => void;
}

export interface HeaderProps {
  addSuccessToast: (msg: string, options?: ToastOptions) => void;
  addDangerToast: (msg: string, options?: ToastOptions) => void;
  addWarningToast: (msg: string, options?: ToastOptions) => void;
  colorNamespace?: string;
  charts: ChartState | {};
  colorScheme?: string;
  customCss: string;
  user: JsonObject | undefined;
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
  savePublished: (dashboardId: number, isPublished: boolean) => void;
  updateDashboardTitle: (nextTitle: string) => void;
  editMode: boolean;
  setEditMode: () => void;
  showBuilderPane: () => void;
  updateCss: () => void;
  logEvent: (eventName: string, eventData: JsonObject) => void;
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
