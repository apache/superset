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
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
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
import {
  getChartDataRequest,
  handleChartDataResponse,
} from 'src/components/Chart/chartAction';
import { getQuerySettings } from 'src/explore/exploreUtils';
import type { Dataset } from 'src/components/Chart/types';
import type { ExplorePageState } from 'src/explore/types';
import { selectVersionPreview } from './reducer';
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
  const preview = useSelector(selectVersionPreview);
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
  // retrigger the preview fetch.
  const liveDatasourceRef = useRef(datasource);
  liveDatasourceRef.current = datasource;

  const entityUuid = preview?.entityUuid;
  const versionUuid = preview?.versionUuid;

  useEffect(() => {
    if (!entityUuid || !versionUuid) {
      return;
    }
    fetchIdRef.current += 1;
    const fetchId = fetchIdRef.current;
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
      // The snapshot may reference a different datasource than the live
      // chart (e.g. the chart was switched to another dataset since);
      // fetch the metadata the preview should label itself with.
      const live = liveDatasourceRef.current as
        | (Dataset & { id?: number; type?: string })
        | undefined;
      let datasourceMeta: Dataset | undefined = live;
      if (
        !live ||
        live.id !== snapshot.datasource_id ||
        live.type !== snapshot.datasource_type
      ) {
        try {
          datasourceMeta = (await fetchDatasourceMetadata(
            snapshot.datasource_id,
            snapshot.datasource_type,
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
        snapshot.viz_type,
        snapshot.datasource_id,
        snapshot.datasource_type,
      );
      const [useLegacyApi] = getQuerySettings(previewFormData);
      const { response, json } = await getChartDataRequest({
        formData: previewFormData,
      });
      const result = await handleChartDataResponse(
        response,
        json,
        useLegacyApi,
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
        }
      });
  }, [entityUuid, versionUuid]);

  if (!preview) {
    return null;
  }

  return (
    <Container data-test="chart-version-preview">
      <PreviewBanner entityType="chart" />
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
