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
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import type { Dataset } from 'src/components/Chart/types';
import type { ExplorePageState } from 'src/explore/types';
import { fetchDatasourceMetadata } from 'src/features/versionHistory/api';

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

export interface ProposedChartPreviewProps {
  /** Built by `proposedChartFormData`; the proposal, not the live chart. */
  formData: QueryFormData;
  /**
   * A change still open on the dataset this chart is built on.
   *
   * The preview queries the live dataset, because that is what approving
   * this chart today would query. A proposal written against columns that
   * are themselves awaiting review therefore fails, or quietly draws
   * against the old definition, and either way the reviewer needs to know
   * the two decisions are ordered (QA-09).
   */
  pendingDataset?: { title?: string | null; author?: string | null } | null;
}

function datasourceKey(datasource?: string): string | undefined {
  return typeof datasource === 'string' ? datasource : undefined;
}

/**
 * The chart as it would be if this change were approved.
 *
 * Queried as an unsaved chart from the captured form data, so the live
 * chart's cached result is neither read nor overwritten, and drawn with the
 * same `SuperChart` the real chart panel uses -- the proposal is rendered by
 * the plugin that would render it after approval, not by a second renderer
 * that could disagree with it.
 *
 * The control panels beside this are left showing the live chart, greyed and
 * inert. They are the author's working copy; writing the proposal into them
 * would make a reviewer's session look like an edit, and on a chart whose
 * change was then rejected it would be an edit they never made.
 */
export default function ProposedChartPreview({
  formData,
  pendingDataset,
}: ProposedChartPreviewProps) {
  const liveDatasource = useSelector<ExplorePageState, Dataset | undefined>(
    state => state.explore?.datasource as unknown as Dataset | undefined,
  );
  const [queriesData, setQueriesData] = useState<QueryData[] | null>(null);
  const [datasource, setDatasource] = useState<Dataset | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  // Read through a ref so a re-hydration of the live chart's datasource does
  // not restart the preview's query.
  const liveDatasourceRef = useRef(liveDatasource);
  useEffect(() => {
    liveDatasourceRef.current = liveDatasource;
  }, [liveDatasource]);

  const proposedDatasource = datasourceKey(formData.datasource);

  useEffect(() => {
    fetchIdRef.current += 1;
    const fetchId = fetchIdRef.current;
    // Abort the chart-data wait rather than only dropping its result: an
    // async query keeps polling and holds its tasks open otherwise.
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setQueriesData(null);
    setDatasource(undefined);

    const load = async () => {
      const live = liveDatasourceRef.current as
        | (Dataset & { id?: number; type?: string })
        | undefined;
      const liveKey =
        live?.id != null && live?.type ? `${live.id}__${live.type}` : undefined;
      let meta: Dataset | undefined = live;
      if (proposedDatasource && proposedDatasource !== liveKey) {
        // The proposal moved the chart to another dataset, so the live
        // metadata would label the preview with the wrong columns.
        const [rawId, rawType] = proposedDatasource.split('__');
        try {
          meta = (await fetchDatasourceMetadata(
            Number(rawId),
            rawType,
          )) as unknown as Dataset;
        } catch {
          if (fetchId === fetchIdRef.current) {
            setError(
              t(
                'The dataset this change points at is not available, so the proposed chart cannot be shown. "What changed" lists the settings it would apply.',
              ),
            );
          }
          return;
        }
      }
      const result = await requestChartDataResolved(
        { formData },
        controller.signal,
      );
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      setQueriesData(result);
      setDatasource(meta);
    };

    load()
      .catch(async response => {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        const { error: clientError, message } = await getClientErrorObject(
          response as Parameters<typeof getClientErrorObject>[0],
        );
        // A proposal that will not query is itself worth knowing before
        // approving it, so the query's own message is kept rather than
        // replaced with a generic failure.
        setError(
          clientError ||
            message ||
            t('The proposed chart could not be loaded.'),
        );
      })
      .finally(() => {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      fetchIdRef.current += 1;
      controller.abort();
    };
  }, [formData, proposedDatasource]);

  return (
    <Container data-test="proposed-chart-preview" aria-busy={isLoading}>
      {pendingDataset && (
        <Alert
          type="warning"
          closable={false}
          data-test="proposed-chart-pending-dataset"
          message={t(
            'This chart is built on a dataset that has its own change awaiting review%s. The preview is drawn against the live dataset, so decide the dataset first.',
            pendingDataset.author ? t(' from %s', pendingDataset.author) : '',
          )}
        />
      )}
      {isLoading && <Loading />}
      {!isLoading && error && (
        <Alert type="error" closable={false} message={error} />
      )}
      {!isLoading && !error && queriesData && (
        <ChartArea>
          {/* SuperChart's own error boundary stays, so a plugin that throws
              on the proposed settings degrades to a contained error instead
              of taking the review page down with it. */}
          <SuperChart
            chartType={formData.viz_type}
            enableNoResults
            datasource={datasource}
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
