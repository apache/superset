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
import React from 'react';
import Alert from 'src/components/Alert';
import { t } from '@superset-ui/core';
import { Query } from 'src/SqlLab/types';
import QueryTable from 'src/SqlLab/components/QueryTable';

interface QueryHistoryProps {
  queries: Query[];
  actions: Record<string, unknown>;
  displayLimit: number;
}

const QueryHistory = ({ queries, actions, displayLimit }: QueryHistoryProps) =>
  queries.length > 0 ? (
    <QueryTable
      columns={[
        'state',
        'started',
        'duration',
        'progress',
        'rows',
        'sql',
        'output',
        'actions',
      ]}
      queries={queries}
      actions={actions}
      displayLimit={displayLimit}
    />
  ) : (
    <Alert type="info" message={t('No query history yet...')} />
  );

export default QueryHistory;
