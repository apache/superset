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
import { useEffect, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useInView } from 'react-intersection-observer';
import { omit } from 'lodash';
import { EmptyState, Skeleton } from '@superset-ui/core/components';
import {
  t,
  styled,
  css,
  FeatureFlag,
  isFeatureEnabled,
  useTheme,
} from '@superset-ui/core';
import QueryTable from 'src/SqlLab/components/QueryTable';
import { SqlLabRootState } from 'src/SqlLab/types';
import { useEditorQueriesQuery } from 'src/hooks/apiResources/queries';
import useEffectEvent from 'src/hooks/useEffectEvent';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';

interface QueryHistoryProps {
  queryEditorId: string | number;
  displayLimit: number;
  latestQueryId: string | undefined;
}

const StyledEmptyStateWrapper = styled.div`
  height: 100%;
  .ant-empty-image img {
    margin-right: 28px;
  }

  p {
    margin-right: 28px;
  }
`;

const getEditorQueries = (
  queries: SqlLabRootState['sqlLab']['queries'],
  queryEditorId: string | number,
) =>
  Object.values(queries).filter(
    ({ sqlEditorId }) => String(sqlEditorId) === String(queryEditorId),
  );

const QueryHistory = ({
  queryEditorId,
  displayLimit,
  latestQueryId,
}: QueryHistoryProps) => {
  const { id, tabViewId } = useQueryEditor(String(queryEditorId), [
    'tabViewId',
  ]);
  const theme = useTheme();
  const editorId = tabViewId ?? id;
  const [ref, hasReachedBottom] = useInView({ threshold: 0 });
  const [pageIndex, setPageIndex] = useState(0);
  const queries = useSelector(
    ({ sqlLab: { queries } }: SqlLabRootState) => queries,
    shallowEqual,
  );
  const {
    currentData: data,
    isLoading,
    isFetching,
  } = useEditorQueriesQuery(
    { editorId, pageIndex },
    {
      skip: !isFeatureEnabled(FeatureFlag.SqllabBackendPersistence),
    },
  );
  const editorQueries = useMemo(
    () =>
      data
        ? getEditorQueries(
            omit(
              queries,
              data.result.map(({ id }) => id),
            ),
            editorId,
          )
            .concat(data.result)
            .sort((a, b) => {
              const aTime = a.startDttm || 0;
              const bTime = b.startDttm || 0;
              return aTime - bTime;
            })
        : getEditorQueries(queries, editorId),
    [queries, data, editorId],
  );

  const loadNext = useEffectEvent(() => {
    setPageIndex(pageIndex + 1);
  });

  const loadedDataCount = data?.result.length || 0;
  const totalCount = data?.count || 0;

  useEffect(() => {
    if (hasReachedBottom && loadedDataCount < totalCount) {
      loadNext();
    }
  }, [hasReachedBottom, loadNext, loadedDataCount, totalCount]);

  if (!editorQueries.length && isLoading) {
    return <Skeleton active />;
  }

  return editorQueries.length > 0 ? (
    <div
      css={css`
        padding-left: ${theme.sizeUnit * 4}px;
      `}
    >
      <QueryTable
        columns={[
          'state',
          'started',
          'duration',
          'progress',
          'rows',
          'sql',
          'results',
          'actions',
        ]}
        queries={editorQueries}
        displayLimit={displayLimit}
        latestQueryId={latestQueryId}
      />
      {data && loadedDataCount < totalCount && (
        <div
          ref={ref}
          css={css`
            position: relative;
            top: -150px;
          `}
        />
      )}
      {isFetching && <Skeleton active />}
    </div>
  ) : (
    <StyledEmptyStateWrapper>
      <EmptyState
        title={t('Run a query to display query history')}
        size="medium"
        image="document.svg"
      />
    </StyledEmptyStateWrapper>
  );
};

export default QueryHistory;
