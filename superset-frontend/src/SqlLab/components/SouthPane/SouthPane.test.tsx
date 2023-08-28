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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import SouthPane, { SouthPaneProps } from 'src/SqlLab/components/SouthPane';
import '@testing-library/jest-dom/extend-expect';
import { STATUS_OPTIONS } from 'src/SqlLab/constants';
import { initialState, table, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { denormalizeTimestamp } from '@superset-ui/core';
import { Store } from 'redux';

const mockedProps = {
  queryEditorId: defaultQueryEditor.id,
  latestQueryId: 'LCly_kkIN',
  height: 1,
  displayLimit: 1,
  defaultQueryLimit: 100,
};

const mockedEmptyProps = {
  queryEditorId: 'random_id',
  latestQueryId: '',
  height: 100,
  displayLimit: 100,
  defaultQueryLimit: 100,
};

jest.mock('src/SqlLab/components/SqlEditorLeftBar', () => jest.fn());

const latestQueryProgressMsg = 'LATEST QUERY MESSAGE - LCly_kkIN';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const store = mockStore({
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
      },
      lXJa7F9_r: {
        cached: false,
        changed_on: denormalizeTimestamp(new Date(1559238500401).toISOString()),
        db: 'main',
        dbId: 1,
        id: 'lXJa7F9_r',
        startDttm: 1559238500401,
        sqlEditorId: defaultQueryEditor.id,
      },
      '2g2_iRFMl': {
        cached: false,
        changed_on: denormalizeTimestamp(new Date(1559238506925).toISOString()),
        db: 'main',
        dbId: 1,
        id: '2g2_iRFMl',
        startDttm: 1559238506925,
        sqlEditorId: defaultQueryEditor.id,
      },
      erWdqEWPm: {
        cached: false,
        changed_on: denormalizeTimestamp(new Date(1559238516395).toISOString()),
        db: 'main',
        dbId: 1,
        id: 'erWdqEWPm',
        startDttm: 1559238516395,
        sqlEditorId: defaultQueryEditor.id,
      },
    },
  },
});
const setup = (props: SouthPaneProps, store: Store) =>
  render(<SouthPane {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

describe('SouthPane', () => {
  const renderAndWait = (props: SouthPaneProps, store: Store) =>
    waitFor(async () => setup(props, store));

  it('Renders an empty state for results', async () => {
    await renderAndWait(mockedEmptyProps, store);
    const emptyStateText = screen.getByText(/run a query to display results/i);
    expect(emptyStateText).toBeVisible();
  });

  it('should render offline when the state is offline', async () => {
    await renderAndWait(
      mockedEmptyProps,
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          offline: true,
        },
      }),
    );

    expect(screen.getByText(STATUS_OPTIONS.offline)).toBeVisible();
  });

  it('should pass latest query down to ResultSet component', async () => {
    await renderAndWait(mockedProps, store);

    expect(screen.getByText(latestQueryProgressMsg)).toBeVisible();
  });
});
