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

export interface HeaderDropdownProps {
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
  lastModifiedTime: number;
}

export interface HeaderProps {
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
  setColorSchemeAndUnsavedChanges: () => void;
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
