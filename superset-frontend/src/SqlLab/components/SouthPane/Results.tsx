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
import { FC, useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { EmptyState } from '@superset-ui/core/components';
import { t } from '@apache-superset/core';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { styled, Alert } from '@apache-superset/core/ui';

import { SqlLabRootState } from 'src/SqlLab/types';
import ResultSet from '../ResultSet';
import { LOCALSTORAGE_MAX_QUERY_AGE_MS } from '../../constants';
import QueryStatusBar from '../QueryStatusBar';

type Props = {
  latestQueryId?: string;
  displayLimit: number;
  defaultQueryLimit: number;
};

const StyledEmptyStateWrapper = styled.div`
  height: 100%;
  .ant-empty-image img {
    margin-right: 28px;
  }

  p {
    margin-right: 28px;
  }
`;

const Results: FC<Props> = ({
  latestQueryId,
  displayLimit,
  defaultQueryLimit,
}) => {
  const databases = useSelector(
    ({ sqlLab: { databases } }: SqlLabRootState) => databases,
    shallowEqual,
  );
  const queries = useSelector(
    ({ sqlLab: { queries } }: SqlLabRootState) => queries,
    shallowEqual,
  );
  const latestQuery = useMemo(
    () => queries[latestQueryId ?? ''],
    [queries, latestQueryId],
  );

  if (
    !latestQuery ||
    Date.now() - latestQuery.startDttm > LOCALSTORAGE_MAX_QUERY_AGE_MS
  ) {
    return (
      <StyledEmptyStateWrapper>
        <EmptyState
          title={t('Run a query to display results')}
          image="document.svg"
        />
      </StyledEmptyStateWrapper>
    );
  }

  const hasNoStoredResults =
    isFeatureEnabled(FeatureFlag.SqllabBackendPersistence) &&
    latestQuery.state === 'success' &&
    !latestQuery.resultsKey &&
    !latestQuery.results;

  return (
    <>
      <QueryStatusBar key={latestQueryId} query={latestQuery} />
      {hasNoStoredResults ? (
        <Alert
          type="info"
          message={t('No stored results found, you need to re-run your query')}
        />
      ) : (
        <ResultSet
          search
          queryId={latestQuery.id}
          database={databases[latestQuery.dbId]}
          displayLimit={displayLimit}
          defaultQueryLimit={defaultQueryLimit}
          showSql
          showSqlInline
        />
      )}
    </>
  );
};

export default Results;
