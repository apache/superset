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
import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { QueryFormData, SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import { Change, Version } from '../types';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import PreviewBanner from '../components/PreviewBanner';
import {
  useOptionalVersionHistory,
  VersionHistoryProvider,
} from '../context/VersionHistoryContext';
import { ChartPreviewContext } from '../context/ChartPreviewContext';
import { useVersionSnapshot } from '../hooks/useVersionSnapshot';
import { useVersionList } from '../hooks/useVersionList';
import { useRestoreVersion } from '../hooks/useRestoreVersion';
import { snapshotToFormData } from '../utils/snapshotToFormData';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { formatVersionDate } from '../utils/formatVersionUser';
import { forkChartFromSnapshot } from '../utils/forkActions';

interface InnerProps {
  chartUuid: string | null | undefined;
  formData: QueryFormData | undefined;
  children: React.ReactNode;
}

interface BannerProps {
  chartUuid: string | null | undefined;
  snapshotSummary: string;
  issuedAt: string;
}

function ExplorePreviewBanner({
  chartUuid,
  snapshotSummary,
  issuedAt,
}: BannerProps) {
  const ctx = useOptionalVersionHistory();
  const { versions } = useVersionList('chart', chartUuid);
  const { restore, restoring } = useRestoreVersion('chart', chartUuid);

  // Prefer the matching list row's metadata. The single-version snapshot
  // endpoint nests version metadata under ``_version`` (and may omit
  // issued_at from the root), so we'd render "Invalid Date" without this
  // fallback chain.
  const matched = versions?.find(
    v => v.version_uuid === ctx?.previewVersionUuid,
  );
  const summary = matched
    ? formatChangeTitle(matched.changes)
    : snapshotSummary;
  const resolvedIssuedAt = matched?.issued_at ?? issuedAt;

  const handleRestore = async () => {
    if (!ctx?.previewVersionUuid) return;
    const ok = await restore(ctx.previewVersionUuid);
    if (ok) {
      ctx.exitPreview();
      // Reload so the chart re-fetches with the restored form_data — the
      // Redux slice still holds the pre-restore state.
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  return (
    <PreviewBanner
      summary={summary}
      date={resolvedIssuedAt ? formatVersionDate(resolvedIssuedAt) : ''}
      onRestore={handleRestore}
      onExit={() => ctx?.exitPreview()}
      restoring={restoring}
    />
  );
}

function ExploreVersionHistoryInner({
  chartUuid,
  formData,
  children,
}: InnerProps) {
  const ctx = useOptionalVersionHistory();
  const dispatch = useDispatch();
  const history = useHistory();
  const ownerId = useSelector(
    (state: { user?: { userId?: number } }) => state.user?.userId,
  );
  const previewVersionUuid = ctx?.previewVersionUuid ?? null;
  const { snapshot } = useVersionSnapshot(
    'chart',
    chartUuid,
    previewVersionUuid,
  );
  const previewFormData = useMemo(
    () => snapshotToFormData(snapshot, formData),
    [snapshot, formData],
  );

  const handleOpenAsNew = useCallback(
    async (version: Version) => {
      if (!chartUuid) return;
      try {
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/chart/${chartUuid}/versions/${version.version_uuid}/`,
        });
        const created = await forkChartFromSnapshot(
          json as unknown as Parameters<typeof forkChartFromSnapshot>[0],
          ownerId,
        );
        dispatch(
          addSuccessToast(
            t('Created from version: %(summary)s', {
              summary: formatChangeTitle(version.changes),
            }),
          ),
        );
        history.push(`/explore/?slice_id=${created.id}`);
      } catch (e) {
        dispatch(addDangerToast(t('Failed to create chart from version')));
      }
    },
    [chartUuid, dispatch, history, ownerId],
  );

  // The snapshot endpoint nests version metadata under ``_version`` —
  // ``changes`` + ``issued_at`` live there, with ``issued_at`` absent
  // from the root. The list endpoint puts them at the root. The banner
  // prefers the list row when it's loaded; these are the fallbacks.
  const snapshotMeta =
    (snapshot as { _version?: { changes?: Change[]; issued_at?: string } })
      ?._version ?? {};
  const snapshotChanges = Array.isArray(snapshot?.changes)
    ? (snapshot.changes as Change[])
    : (snapshotMeta.changes ?? []);
  const snapshotIssuedAt =
    (typeof snapshot?.issued_at === 'string' && snapshot.issued_at) ||
    snapshotMeta.issued_at ||
    '';

  return (
    <ChartPreviewContext.Provider value={previewFormData}>
      {previewFormData && snapshot && (
        <ExplorePreviewBanner
          chartUuid={chartUuid}
          snapshotSummary={formatChangeTitle(snapshotChanges)}
          issuedAt={snapshotIssuedAt}
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
  formData,
  children,
}: InnerProps) {
  return (
    <VersionHistoryProvider>
      <div
        data-test="version-history-provider-mount"
        data-test-entity-type="chart"
        style={{ display: 'contents' }}
      >
        <ExploreVersionHistoryInner chartUuid={chartUuid} formData={formData}>
          {children}
        </ExploreVersionHistoryInner>
      </div>
    </VersionHistoryProvider>
  );
}
