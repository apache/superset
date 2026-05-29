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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { QueryFormData } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import { replaceChartState } from 'src/components/Chart/chartAction';
import type { ChartState } from 'src/explore/types';
import { reloadStrippingVersionUuid } from '../utils/restoreReload';
import { Change } from '../types';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import PreviewBanner from '../components/PreviewBanner';
import RestoreConfirmModal from '../components/RestoreConfirmModal';
import {
  useOptionalVersionHistory,
  VersionHistoryProvider,
} from '../context/VersionHistoryContext';
import {
  ChartPreviewContext,
  ChartPreviewSliceOverrides,
  ChartPreviewValue,
} from '../context/ChartPreviewContext';
import { useForkVersion } from '../hooks/useForkVersion';
import { useVersionSnapshot } from '../hooks/useVersionSnapshot';
import { useVersionList } from '../hooks/useVersionList';
import { useRestoreVersion } from '../hooks/useRestoreVersion';
import { snapshotToFormData } from '../utils/snapshotToFormData';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { formatVersionDate } from '../utils/formatVersionUser';

interface InnerProps {
  chartUuid: string | null | undefined;
  chartId: number | null | undefined;
  formData: QueryFormData | undefined;
  hasUnsavedChanges?: boolean;
  children: React.ReactNode;
}

interface BannerProps {
  chartUuid: string | null | undefined;
  snapshotSummary: string;
  issuedAt: string;
  hasUnsavedChanges?: boolean;
}

interface ChartStatePreviewBridgeProps {
  chartId: number;
  previewActive: boolean;
}

/**
 * Captures ``state.charts[chartId]`` on enter and restores it on exit so
 * queries fired while previewing a snapshot don't pollute the live chart's
 * ``queriesResponse`` / ``latestQueryFormData`` / status. The ChartContainer
 * reads everything keyed by ``chart.id`` from Redux; previewing changes the
 * rendered ``formData`` but the same key is written back, leaving snapshot
 * query results cached on the live chart after exit unless we restore.
 */
function ChartStatePreviewBridge({
  chartId,
  previewActive,
}: ChartStatePreviewBridgeProps) {
  const dispatch = useDispatch();
  const store = useStore<{ charts?: Record<string, ChartState> }>();
  const capturedRef = useRef<ChartState | null>(null);

  useEffect(() => {
    if (previewActive) {
      if (capturedRef.current === null) {
        const current = store.getState().charts?.[chartId];
        if (current) {
          // Shallow clone — query results / annotations are replaced
          // wholesale by their reducers, so this is enough to detect any
          // pollution during preview.
          capturedRef.current = { ...current } as ChartState;
        }
      }
      return undefined;
    }
    // Preview just turned off (or never turned on): restore if we have a
    // capture.
    if (capturedRef.current) {
      dispatch(replaceChartState(chartId, capturedRef.current));
      capturedRef.current = null;
    }
    return undefined;
  }, [chartId, dispatch, previewActive, store]);

  useEffect(
    () => () => {
      // Unmount safety: if the user navigates away mid-preview, still
      // restore the captured state. The reducer is a no-op when the chart
      // entry is already absent (e.g. explore page unmount), so this is
      // safe.
      if (capturedRef.current) {
        dispatch(replaceChartState(chartId, capturedRef.current));
        capturedRef.current = null;
      }
    },
    [chartId, dispatch],
  );

  return null;
}

function ExplorePreviewBanner({
  chartUuid,
  snapshotSummary,
  issuedAt,
  hasUnsavedChanges,
}: BannerProps) {
  const ctx = useOptionalVersionHistory();
  const dispatch = useDispatch();
  const { versions } = useVersionList('chart', chartUuid);
  const { restore, restoring } = useRestoreVersion('chart', chartUuid);
  const forkVersion = useForkVersion('chart', chartUuid);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Prefer the matching list row's metadata — the snapshot endpoint may
  // omit ``issued_at`` until the list response loads.
  const matched = versions?.find(
    v => v.version_uuid === ctx?.previewVersionUuid,
  );
  const summary = matched
    ? formatChangeTitle(matched.changes)
    : snapshotSummary;
  const resolvedIssuedAt = matched?.issued_at ?? issuedAt;
  const date = resolvedIssuedAt ? formatVersionDate(resolvedIssuedAt) : '';

  const handleConfirmRestore = async () => {
    if (!ctx?.previewVersionUuid) return;
    const { ok, error } = await restore(ctx.previewVersionUuid);
    if (ok) {
      dispatch(
        addSuccessToast(t("Restored to '%(summary)s' version", { summary })),
      );
      setConfirmOpen(false);
      ctx.exitPreview();
      // Strip ``?version_uuid`` synchronously so the reloaded page does
      // not re-enter preview of the restored version (the URL-write
      // effect runs after React commits and would lose this race).
      reloadStrippingVersionUuid();
    } else {
      dispatch(
        addDangerToast(
          error
            ? t('Failed to restore version: %(detail)s', { detail: error })
            : t('Failed to restore version'),
        ),
      );
    }
  };

  return (
    <>
      <PreviewBanner
        entityType="chart"
        summary={summary}
        date={date}
        onRestore={() => setConfirmOpen(true)}
        onExit={() => ctx?.exitPreview()}
        onOpenAsNew={matched ? () => forkVersion(matched) : undefined}
        restoring={restoring}
      />
      <RestoreConfirmModal
        open={confirmOpen}
        entityType="chart"
        summary={summary}
        date={date}
        restoring={restoring}
        hasUnsavedChanges={hasUnsavedChanges}
        onConfirm={handleConfirmRestore}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function ExploreVersionHistoryInner({
  chartUuid,
  chartId,
  formData,
  hasUnsavedChanges,
  children,
}: InnerProps) {
  const ctx = useOptionalVersionHistory();
  const dispatch = useDispatch();
  const handleOpenAsNew = useForkVersion('chart', chartUuid);
  const previewVersionUuid = ctx?.previewVersionUuid ?? null;
  const { snapshot, error: snapshotError } = useVersionSnapshot(
    'chart',
    chartUuid,
    previewVersionUuid,
  );

  // Snapshot fetch failed — most often the user followed a stale
  // ?version_uuid URL whose version is no longer accessible. Surface the
  // failure and clear the URL so the next reload doesn't re-enter the
  // same failed state.
  useEffect(() => {
    if (previewVersionUuid && snapshotError) {
      dispatch(
        addDangerToast(
          t('Could not load this version: %(detail)s', {
            detail: snapshotError,
          }),
        ),
      );
      ctx?.exitPreview();
    }
    // ``ctx`` is stable from the provider; we only re-run on the error
    // arriving for a still-active preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, previewVersionUuid, snapshotError]);
  const previewFormData = useMemo(
    () => snapshotToFormData(snapshot, formData),
    [snapshot, formData],
  );
  // Slice-level scalars (title, description, certification badge text) are
  // read directly from Redux ``state.explore.slice`` by the Explore header
  // and metadata bar. Surface them via context so consumers can prefer the
  // snapshot value during preview without mutating the live slice.
  const previewSlice = useMemo<ChartPreviewSliceOverrides | null>(() => {
    if (!snapshot) return null;
    const overrides: ChartPreviewSliceOverrides = {};
    if (typeof snapshot.slice_name === 'string') {
      overrides.slice_name = snapshot.slice_name;
    }
    if (
      typeof snapshot.description === 'string' ||
      snapshot.description === null
    ) {
      overrides.description = snapshot.description as string | null;
    }
    if (typeof snapshot.certified_by === 'string') {
      overrides.certified_by = snapshot.certified_by;
    }
    if (typeof snapshot.certification_details === 'string') {
      overrides.certification_details = snapshot.certification_details;
    }
    return overrides;
  }, [snapshot]);
  const previewValue = useMemo<ChartPreviewValue>(
    () => ({ formData: previewFormData, slice: previewSlice }),
    [previewFormData, previewSlice],
  );

  // ``changes`` only appears on the list payload, never on the
  // snapshot endpoint, so we default to [] here and rely on the banner
  // to prefer the matched list row when one is loaded.
  const snapshotChanges = Array.isArray(snapshot?.changes)
    ? (snapshot.changes as Change[])
    : [];
  const snapshotIssuedAt =
    typeof snapshot?.issued_at === 'string' ? snapshot.issued_at : '';

  const previewActive = !!(previewFormData && snapshot);
  return (
    <ChartPreviewContext.Provider value={previewValue}>
      {previewActive && (
        <ExplorePreviewBanner
          chartUuid={chartUuid}
          snapshotSummary={formatChangeTitle(snapshotChanges)}
          issuedAt={snapshotIssuedAt}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}
      {typeof chartId === 'number' && (
        <ChartStatePreviewBridge
          chartId={chartId}
          previewActive={previewActive}
        />
      )}
      {children}
      <VersionHistoryPanel
        entityType="chart"
        uuid={chartUuid}
        onOpenAsNew={handleOpenAsNew}
      />
    </ChartPreviewContext.Provider>
  );
}

/**
 * Wraps the Explore subtree with the version-history feature: provides the
 * panel + preview banner + the chart-preview form_data context. Visible only
 * when ``chartUuid`` is set (i.e. a saved chart is open).
 */
export function ExploreVersionHistoryRoot({
  chartUuid,
  chartId,
  formData,
  hasUnsavedChanges,
  children,
}: InnerProps) {
  return (
    <VersionHistoryProvider>
      <div
        data-test="version-history-provider-mount"
        data-test-entity-type="chart"
        style={{ display: 'contents' }}
      >
        <ExploreVersionHistoryInner
          chartUuid={chartUuid}
          chartId={chartId}
          formData={formData}
          hasUnsavedChanges={hasUnsavedChanges}
        >
          {children}
        </ExploreVersionHistoryInner>
      </div>
    </VersionHistoryProvider>
  );
}
