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
import React, { useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { EmptyStateMedium } from 'src/components/EmptyState';
import { t, styled } from '@superset-ui/core';
import QueryTable from 'src/SqlLab/components/QueryTable';
import { SqlLabRootState } from 'src/SqlLab/types';

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

const QueryHistory = ({
  queryEditorId,
  displayLimit,
  latestQueryId,
}: QueryHistoryProps) => {
  const queries = useSelector(
    ({ sqlLab: { queries } }: SqlLabRootState) => queries,
    shallowEqual,
  );
  const editorQueries = useMemo(
    () =>
      Object.values(queries).filter(
        ({ sqlEditorId }) => String(sqlEditorId) === String(queryEditorId),
      ),
    [queries, queryEditorId],
  );

  return editorQueries.length > 0 ? (
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
  ) : (
    <StyledEmptyStateWrapper>
      <EmptyStateMedium
        title={t('Run a query to display query history')}
        image="document.svg"
      />
    </StyledEmptyStateWrapper>
  );
};

export default QueryHistory;
