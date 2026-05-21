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
import { ReactNode, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  enterVersionPreview,
  exitVersionPreview,
} from 'src/dashboard/actions/dashboardState';
import type { RootState } from 'src/dashboard/types';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import {
  VersionHistoryProvider,
  useOptionalVersionHistory,
} from '../context/VersionHistoryContext';
import { useVersionSnapshot } from '../hooks/useVersionSnapshot';

interface Props {
  dashboardUuid: string | null | undefined;
  children: ReactNode;
}

/**
 * Adapter that subscribes to ``previewVersionUuid`` from context, fetches the
 * matching snapshot, and drives the Redux captured-original swap. Cleans up
 * on unmount.
 */
function DashboardPreviewBridge({
  dashboardUuid,
}: {
  dashboardUuid: string | null | undefined;
}) {
  const ctx = useOptionalVersionHistory();
  const previewVersionUuid = ctx?.previewVersionUuid ?? null;
  const dispatch = useDispatch();
  const versionPreview = useSelector(
    (state: RootState) =>
      (
        state.dashboardState as unknown as {
          versionPreview?: { versionUuid: string } | null;
        }
      ).versionPreview ?? null,
  );
  const { snapshot } = useVersionSnapshot(
    'dashboard',
    dashboardUuid,
    previewVersionUuid,
  );
  const lastAppliedRef = useRef<string | null>(null);

  // Enter preview when a snapshot is available for the requested uuid.
  useEffect(() => {
    if (!previewVersionUuid || !snapshot) return;
    if (lastAppliedRef.current === previewVersionUuid) return;
    dispatch(
      enterVersionPreview(
        previewVersionUuid,
        snapshot as unknown as Parameters<typeof enterVersionPreview>[1],
      ),
    );
    lastAppliedRef.current = previewVersionUuid;
  }, [dispatch, previewVersionUuid, snapshot]);

  // Exit when context clears the preview, or on unmount.
  useEffect(() => {
    if (!previewVersionUuid && versionPreview) {
      dispatch(exitVersionPreview());
      lastAppliedRef.current = null;
    }
  }, [dispatch, previewVersionUuid, versionPreview]);

  useEffect(
    () => () => {
      // Unmount cleanup.
      if (lastAppliedRef.current) {
        dispatch(exitVersionPreview());
      }
    },
    [dispatch],
  );

  return null;
}

/**
 * Mounts the cross-entity VersionHistoryProvider + side panel for the
 * dashboard view, and connects the preview state to the dashboardState
 * reducer's captured-original swap.
 */
export function DashboardVersionHistoryRoot({
  dashboardUuid,
  children,
}: Props) {
  return (
    <VersionHistoryProvider>
      {children}
      <DashboardPreviewBridge dashboardUuid={dashboardUuid} />
      <VersionHistoryPanel entityType="dashboard" uuid={dashboardUuid} />
    </VersionHistoryProvider>
  );
}
