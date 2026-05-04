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

import { type Dispatch, type SetStateAction } from 'react';
import { JsonObject } from '@superset-ui/core';
import {
  DashboardInfo as DashboardInfoType,
  Layout,
} from 'src/dashboard/types';
import { ChartState } from 'src/explore/types';
import { AlertObject } from 'src/features/alerts/types';
import { ToastMeta } from 'src/components/MessageToasts/types';

type ToastOptions = Partial<Omit<ToastMeta, 'id' | 'toastType' | 'text'>>;

export interface HeaderDropdownProps {
  addSuccessToast: (msg: string, options?: ToastOptions) => void;
  addDangerToast: (msg: string, options?: ToastOptions) => void;
  customCss?: string;
  colorNamespace?: string;
  colorScheme?: string;
  dashboardId: number;
  dashboardInfo: DashboardInfoType;
  dashboardTitle?: string;
  editMode: boolean;
  expandedSlices?: Record<number, boolean>;
  forceRefreshAllCharts: () => unknown;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  layout: Layout;
  onSave: (...args: unknown[]) => unknown;
  refreshFrequency: number;
  shouldPersistRefreshFrequency: boolean;
  showPropertiesModal: () => void;
  showRefreshModal: () => void;
  userCanEdit: boolean | undefined;
  userCanSave: boolean | undefined;
  userCanShare: boolean | undefined;
  userCanCurate: boolean;
  userCanExport: boolean | undefined;
  manageEmbedded: () => void;
  lastModifiedTime: number;
  logEvent: (...args: unknown[]) => unknown;
  refreshLimit?: number;
  refreshWarning?: string;
  directPathToChild?: string[];
  showReportModal: () => void;
  setCurrentReportDeleting: Dispatch<SetStateAction<AlertObject | null>>;
}

export interface HeaderProps {
  addSuccessToast: (msg: string, options?: ToastOptions) => void;
  addDangerToast: (msg: string, options?: ToastOptions) => void;
  addWarningToast: (msg: string, options?: ToastOptions) => void;
  colorNamespace?: string;
  charts: ChartState | JsonObject;
  colorScheme?: string;
  customCss?: string;
  user: object | undefined;
  dashboardInfo: DashboardInfoType;
  dashboardTitle?: string;
  setColorScheme: () => void;
  setUnsavedChanges: () => void;
  isStarred: boolean;
  isPublished: boolean;
  onChange: () => void;
  onSave: (...args: unknown[]) => unknown;
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
