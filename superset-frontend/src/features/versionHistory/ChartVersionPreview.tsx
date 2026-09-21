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
import { useDispatch, useSelector } from 'react-redux';
import { canOverwriteSlice } from 'src/explore/exploreUtils/canOverwriteSlice';
import { Slice } from 'src/types/Chart';
import {
  getClientErrorObject,
  QueryData,
  QueryFormData,
  SuperChart,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Loading } from '@superset-ui/core/components';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import type { Dataset } from 'src/components/Chart/types';
import type { ExplorePageState } from 'src/explore/types';
import { selectVersionPreview, versionPreviewApplied } from './reducer';
import { fetchDatasourceMetadata, fetchVersionSnapshot } from './api';
import PreviewBanner from './PreviewBanner';

const Container = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    height: 100%;
    padding: ${theme.sizeUnit * 2}px;
  `}
`;

const ChartArea = styled.div`
  flex: 1;
  min-height: 0;
`;

function buildPreviewFormData(
  params: string | null,
  vizType: string,
  datasourceId: number,
  datasourceType: string,
): QueryFormData {
  const parsed = params ? JSON.parse(params) : {};
  return {
    ...parsed,
    viz_type: vizType,
    datasource: `${datasourceId}__${datasourceType}`,
    // Use an unsaved-chart id so the preview never collides with the
    // live chart's cached queries.
    slice_id: 0,
  } as QueryFormData;
}

export default function ChartVersionPreview() {
  const dispatch = useDispatch();
  const preview = useSelector(selectVersionPreview);
  const slice = useSelector<ExplorePageState, Slice | undefined>(
    state => state.explore?.slice ?? undefined,
  );
  const user = useSelector<ExplorePageState, ExplorePageState['user']>(
    state => state.user,
  );
  const canOverwrite = useSelector<ExplorePageState, boolean>(
    state => state.explore?.can_overwrite ?? false,
  );
  // Same predicate as the panel and the menu, so an admin who can open the
  // history can also restore from it.
  const canRestore = useMemo(
    () => canOverwriteSlice({ slice, user, canOverwrite }),
    [slice, user, canOverwrite],
  );
  const datasource = useSelector<ExplorePageState, Dataset | undefined>(
    state => state.explore?.datasource as unknown as Dataset | undefined,
  );
  const [formData, setFormData] = useState<QueryFormData | null>(null);
  const [queriesData, setQueriesData] = useState<QueryData[] | null>(null);
  const [previewDatasource, setPreviewDatasource] = useState<
    Dataset | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  // Read the live datasource through a ref so re-hydrations don't
  // retrigger the preview fetch. Synced in an effect — render-phase ref
  // writes are unsafe under concurrent rendering.
  const liveDatasourceRef = useRef(datasource);
  useEffect(() => {
    liveDatasourceRef.current = datasource;
  }, [datasource]);

  const entityUuid = preview?.entityUuid;
  const versionUuid = preview?.versionUuid;

  useEffect(() => {
    if (!entityUuid || !versionUuid) {
      return;
    }
    fetchIdRef.current += 1;
    const fetchId = fetchIdRef.current;
    // Abort the async chart-data wait (stop polling + cancel the GTF tasks) when
    // the preview is superseded or unmounts, not just suppress the state update.
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setQueriesData(null);
    setFormData(null);
    setPreviewDatasource(undefined);

    const load = async () => {
      const snapshot = await fetchVersionSnapshot(
        'chart',
        entityUuid,
        versionUuid,
      );
      // Every version-table column is nullable, so a version that records no
      // visualization type or dataset cannot be rendered at all — say so
      // rather than requesting `undefined__undefined`.
      const { viz_type: vizType, datasource_id: datasourceId } = snapshot;
      const { datasource_type: datasourceType } = snapshot;
      if (vizType == null || datasourceId == null || datasourceType == null) {
        if (fetchId === fetchIdRef.current) {
          setError(
            t(
              'This version does not record a visualization type and dataset, so it cannot be previewed',
            ),
          );
        }
        return;
      }
      // The snapshot may reference a different datasource than the live
      // chart (e.g. the chart was switched to another dataset since);
      // fetch the metadata the preview should label itself with.
      const live = liveDatasourceRef.current as
        | (Dataset & { id?: number; type?: string })
        | undefined;
      let datasourceMeta: Dataset | undefined = live;
      if (!live || live.id !== datasourceId || live.type !== datasourceType) {
        try {
          datasourceMeta = (await fetchDatasourceMetadata(
            datasourceId,
            datasourceType,
          )) as unknown as Dataset;
        } catch {
          if (fetchId === fetchIdRef.current) {
            setError(
              t(
                'The data this version was built on is no longer available, so it cannot be previewed',
              ),
            );
          }
          return;
        }
      }
      const previewFormData = buildPreviewFormData(
        snapshot.params,
        vizType,
        datasourceId,
        datasourceType,
      );
      const result = await requestChartDataResolved(
        { formData: previewFormData },
        controller.signal,
      );
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      setFormData(previewFormData);
      setQueriesData(result);
      setPreviewDatasource(datasourceMeta);
    };

    load()
      .catch(async response => {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        const { error: clientError, message } = await getClientErrorObject(
          response as Parameters<typeof getClientErrorObject>[0],
        );
        setError(clientError || message || t('Failed to load version preview'));
      })
      .finally(() => {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
          // SET_VERSION_PREVIEW put the store into the applying state; only
          // this announcement leaves it, and the banner withholds Restore
          // until it fires. Announce on failure too: the error alert replaces
          // the chart, so the page is not mislabeling live content as
          // historical, and Restore stays available exactly as it is from the
          // panel kebab — a version whose data can't render is still a valid
          // restore target.
          dispatch(versionPreviewApplied());
        }
      });

    // Invalidate the in-flight request when the preview closes or the
    // component unmounts, so a late /chart/data response cannot set state
    // afterwards.
    return () => {
      fetchIdRef.current += 1;
      controller.abort();
    };
  }, [dispatch, entityUuid, versionUuid]);

  if (!preview) {
    return null;
  }

  return (
    <Container data-test="chart-version-preview">
      <PreviewBanner entityType="chart" canRestore={canRestore} />
      {isLoading && <Loading />}
      {!isLoading && error && (
        <Alert type="error" closable={false} message={error} />
      )}
      {!isLoading && !error && formData && queriesData && (
        <ChartArea>
          {/* keep SuperChart's own error boundary so a render failure on
              stale metadata degrades to a contained error, not a broken
              page */}
          <SuperChart
            chartType={formData.viz_type}
            enableNoResults
            datasource={previewDatasource}
            formData={formData}
            queriesData={queriesData}
            height="100%"
            width="100%"
          />
        </ChartArea>
      )}
    </Container>
  );
}
