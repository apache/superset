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
import { render } from 'spec/helpers/testing-library';
import { initialState, table, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { denormalizeTimestamp } from '@superset-ui/core';
import { LOCALSTORAGE_MAX_QUERY_AGE_MS } from 'src/SqlLab/constants';
import Results from './Results';

const mockedProps = {
  queryEditorId: defaultQueryEditor.id,
  latestQueryId: 'LCly_kkIN',
  height: 1,
  displayLimit: 1,
  defaultQueryLimit: 100,
};

const mockedEmptyProps = {
  queryEditorId: 'random_id',
  latestQueryId: 'empty_query_id',
  height: 100,
  displayLimit: 100,
  defaultQueryLimit: 100,
};

const mockedExpiredProps = {
  ...mockedEmptyProps,
  latestQueryId: 'expired_query_id',
};

const latestQueryProgressMsg = 'LATEST QUERY MESSAGE - LCly_kkIN';
const expireDateTime = Date.now() - LOCALSTORAGE_MAX_QUERY_AGE_MS - 1;

const mockState = {
  ...initialState,
  sqlLab: {
    ...initialState,
    offline: false,
    tables: [
      {
        ...table,
        dataPreviewQueryId: '2g2_iRFMl',
        queryEditorId: defaultQueryEditor.id,
      },
    ],
    databases: {},
    queries: {
      LCly_kkIN: {
        cached: false,
        changed_on: denormalizeTimestamp(new Date().toISOString()),
        db: 'main',
        dbId: 1,
        id: 'LCly_kkIN',
        startDttm: Date.now(),
        sqlEditorId: defaultQueryEditor.id,
        extra: { progress: latestQueryProgressMsg },
        sql: 'select * from table1',
      },
      lXJa7F9_r: {
        cached: false,
        changed_on: denormalizeTimestamp(new Date(1559238500401).toISOString()),
        db: 'main',
        dbId: 1,
        id: 'lXJa7F9_r',
        startDttm: 1559238500401,
        sqlEditorId: defaultQueryEditor.id,
        sql: 'select * from table2',
      },
      '2g2_iRFMl': {
        cached: false,
        changed_on: denormalizeTimestamp(new Date(1559238506925).toISOString()),
        db: 'main',
        dbId: 1,
        id: '2g2_iRFMl',
        startDttm: 1559238506925,
        sqlEditorId: defaultQueryEditor.id,
        sql: 'select * from table3',
      },
      expired_query_id: {
        cached: false,
        changed_on: denormalizeTimestamp(
          new Date(expireDateTime).toISOString(),
        ),
        db: 'main',
        dbId: 1,
        id: 'expired_query_id',
        startDttm: expireDateTime,
        sqlEditorId: defaultQueryEditor.id,
        sql: 'select * from table4',
      },
    },
  },
};

test('Renders an empty state for results', async () => {
  const { getByText } = render(<Results {...mockedEmptyProps} />, {
    useRedux: true,
    initialState: mockState,
  });
  const emptyStateText = getByText(/run a query to display results/i);
  expect(emptyStateText).toBeVisible();
});

test('Renders an empty state for expired results', async () => {
  const { getByText } = render(<Results {...mockedExpiredProps} />, {
    useRedux: true,
    initialState: mockState,
  });
  const emptyStateText = getByText(/run a query to display results/i);
  expect(emptyStateText).toBeVisible();
});

test('should pass latest query down to ResultSet component', async () => {
  const { getByText } = render(<Results {...mockedProps} />, {
    useRedux: true,
    initialState: mockState,
  });
  expect(getByText(latestQueryProgressMsg)).toBeVisible();
});
