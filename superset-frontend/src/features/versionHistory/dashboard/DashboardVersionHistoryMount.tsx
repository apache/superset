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
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import {
  enterVersionPreview,
  exitVersionPreview,
} from 'src/dashboard/actions/dashboardState';
import type { RootState } from 'src/dashboard/types';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import {
  VersionHistoryProvider,
  useRequiredVersionHistory,
} from '../context/VersionHistoryContext';
import { useVersionSnapshot } from '../hooks/useVersionSnapshot';
import { forkDashboardFromSnapshot } from '../utils/forkActions';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { Version } from '../types';

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
  // Bridge always lives inside DashboardVersionHistoryRoot's
  // VersionHistoryProvider, so use the strict variant: a missing provider
  // is a render-tree misconfiguration we want to surface, not silently
  // degrade to the no-op stub.
  const ctx = useRequiredVersionHistory();
  const { previewVersionUuid } = ctx;
  const dispatch = useDispatch();
  const versionPreview = useSelector(
    (state: RootState) => state.dashboardState.versionPreview ?? null,
  );
  const { snapshot } = useVersionSnapshot(
    'dashboard',
    dashboardUuid,
    previewVersionUuid,
  );
  const lastAppliedRef = useRef<string | null>(null);
  // Stable ref so effects that exit on failure / unmount don't tear down a
  // preview the user just opened by triggering a re-run when ctx changes.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  // Enter preview when a snapshot is available for the requested uuid.
  useEffect(() => {
    if (!previewVersionUuid || !snapshot) return;
    if (lastAppliedRef.current === previewVersionUuid) return;
    const entered = dispatch(
      enterVersionPreview(
        previewVersionUuid,
        snapshot as Parameters<typeof enterVersionPreview>[1],
      ),
    ) as unknown as boolean;
    if (entered) {
      lastAppliedRef.current = previewVersionUuid;
    } else {
      // Snapshot lacked usable layout structure — surface the failure to
      // the user and back out of preview mode so the URL/banner don't
      // imply success.
      dispatch(
        addDangerToast(
          t('Snapshot is missing layout structure, cannot preview'),
        ),
      );
      ctxRef.current.exitPreview();
    }
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
      if (lastAppliedRef.current) {
        dispatch(exitVersionPreview());
        // Also clear the URL param so reloading the page after unmount
        // doesn't silently re-enter preview.
        ctxRef.current.exitPreview();
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
function DashboardForkBoundary({
  dashboardUuid,
}: {
  dashboardUuid: string | null | undefined;
}) {
  const dispatch = useDispatch();
  const history = useHistory();
  const ownerId = useSelector(
    (state: { user?: { userId?: number } }) => state.user?.userId,
  );

  const handleOpenAsNew = useCallback(
    async (version: Version) => {
      if (!dashboardUuid) return;
      try {
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/${dashboardUuid}/versions/${version.version_uuid}/`,
        });
        // SupersetClient wraps responses as ``{ result: ... }`` — unwrap so
        // the fork helper sees the actual snapshot fields, not the envelope.
        const snapshotPayload = (
          json as {
            result?: Parameters<typeof forkDashboardFromSnapshot>[0];
          }
        )?.result;
        if (!snapshotPayload) {
          throw new Error('Snapshot payload missing');
        }
        const created = await forkDashboardFromSnapshot(
          snapshotPayload,
          ownerId,
        );
        dispatch(
          addSuccessToast(
            t('Created from version: %(summary)s', {
              summary: formatChangeTitle(version.changes),
            }),
          ),
        );
        history.push(`/superset/dashboard/${created.id}/`);
      } catch (e) {
        dispatch(addDangerToast(t('Failed to create dashboard from version')));
      }
    },
    [dashboardUuid, dispatch, history, ownerId],
  );

  return (
    <VersionHistoryPanel
      entityType="dashboard"
      uuid={dashboardUuid}
      onOpenAsNew={handleOpenAsNew}
    />
  );
}

export function DashboardVersionHistoryRoot({
  dashboardUuid,
  children,
}: Props) {
  return (
    <VersionHistoryProvider>
      <div
        data-test="version-history-provider-mount"
        data-test-entity-type="dashboard"
        style={{ display: 'contents' }}
      >
        {children}
        <DashboardPreviewBridge dashboardUuid={dashboardUuid} />
        <DashboardForkBoundary dashboardUuid={dashboardUuid} />
      </div>
    </VersionHistoryProvider>
  );
}
