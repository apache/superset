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
import { render, waitFor, within } from 'spec/helpers/testing-library';
import SouthPane from 'src/SqlLab/components/SouthPane';
import { STATUS_OPTIONS } from 'src/SqlLab/constants';
import { initialState, table, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { denormalizeTimestamp } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';

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

const latestQueryProgressMsg = 'LATEST QUERY MESSAGE - LCly_kkIN';

const mockState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    offline: false,
    tables: [
      {
        ...table,
        id: 't3',
        name: 'table3',
        dataPreviewQueryId: '2g2_iRFMl',
        queryEditorId: defaultQueryEditor.id,
      },
      {
        ...table,
        id: 't4',
        name: 'table4',
        dataPreviewQueryId: 'erWdqEWPm',
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
      erWdqEWPm: {
        cached: false,
        changed_on: denormalizeTimestamp(new Date(1559238516395).toISOString()),
        db: 'main',
        dbId: 1,
        id: 'erWdqEWPm',
        startDttm: 1559238516395,
        sqlEditorId: defaultQueryEditor.id,
        sql: 'select * from table4',
      },
    },
  },
};

test('should render offline when the state is offline', async () => {
  const { getByText } = render(<SouthPane {...mockedEmptyProps} />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        offline: true,
      },
    },
  });

  expect(getByText(STATUS_OPTIONS.offline)).toBeVisible();
});

test('should render empty result state when latestQuery is empty', () => {
  const { getAllByRole } = render(
    <SouthPane {...mockedProps} latestQueryId={undefined} />,
    {
      useRedux: true,
      initialState: mockState,
    },
  );

  const resultPanel = getAllByRole('tabpanel')[0];
  expect(resultPanel).toHaveTextContent('Run a query to display results');
});

test('should render tabs for table metadata view', () => {
  const { getAllByRole } = render(<SouthPane {...mockedProps} />, {
    useRedux: true,
    initialState: mockState,
  });

  const tabs = getAllByRole('tab');
  expect(tabs).toHaveLength(mockState.sqlLab.tables.length + 2);
  expect(tabs[0]).toHaveTextContent('Results');
  expect(tabs[1]).toHaveTextContent('Query history');
  mockState.sqlLab.tables.forEach(({ name, schema }, index) => {
    expect(tabs[index + 2]).toHaveTextContent(`${schema}.${name}`);
  });
});

test('should remove tab', async () => {
  const { getAllByRole } = await render(<SouthPane {...mockedProps} />, {
    useRedux: true,
    initialState: mockState,
  });

  const tabs = getAllByRole('tab');
  const totalTabs = mockState.sqlLab.tables.length + 2;
  expect(tabs).toHaveLength(totalTabs);
  const removeButton = within(tabs[2].parentElement as HTMLElement).getByRole(
    'button',
    {
      name: /remove/,
    },
  );
  userEvent.click(removeButton);
  await waitFor(() => expect(getAllByRole('tab')).toHaveLength(totalTabs - 1));
});
