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
import fetchMock from 'fetch-mock';
import { render } from 'spec/helpers/testing-library';
import { defaultQueryEditor, initialState } from 'src/SqlLab/fixtures';
import AceEditorTokenProvider, {
  useTokenContext,
  LookUpParams,
} from './AceEditorTokenProvider';
import AceEditorMetadataPopup from '.';

fetchMock.get('glob:*/api/v1/database/*/schemas/?*', {
  count: 1,
  result: ['main'],
});
fetchMock.get('glob:*/api/v1/database/*/tables/?*', {
  result: [
    {
      label: 'table2',
      value: 'table2',
      type: 'table',
    },
  ],
});
fetchMock.get('glob:*/api/v1/database/*/table_metadata/extra/*', {});
fetchMock.get('glob:*/api/v1/database/*/table_metadata/?*', {
  status: 200,
  body: {
    name: 'table1',
    columns: [
      {
        name: 'column1',
        type: 'VARCHAR',
        keys: [],
        comment: null,
      },
      {
        name: 'column2',
        type: 'VARCHAR',
        keys: [],
        comment: null,
      },
    ],
  },
});

const TestTrigger = (params: Partial<LookUpParams>) => {
  const { getMatchTokenData, setActiveTokenData } = useTokenContext();

  return (
    <button
      type="button"
      onClick={() => {
        const tokenData = getMatchTokenData({
          token: {
            type: 'keyword',
            value: 'table1',
            index: 2,
          },
          siblingTokens: [
            {
              type: 'keyword',
              value: 'main',
              index: 0,
            },
            {
              type: 'text',
              value: '.',
              index: 1,
            },
          ],
          position: {
            row: 0,
            column: 0,
          },
          ...params,
        });
        if (tokenData) {
          const [metadataType, metadata] = tokenData;
          setActiveTokenData({
            metadataType,
            metadata,
            markerStyle: { x: 0, y: 0, width: 10 },
          });
        }
      }}
    >
      Trigger
    </button>
  );
};

const setup = (params: Partial<LookUpParams>) =>
  render(
    <AceEditorTokenProvider>
      <AceEditorMetadataPopup />
      <TestTrigger {...params} />
    </AceEditorTokenProvider>,
    {
      useRedux: true,
      initialState: {
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          queryEditors: [
            {
              ...defaultQueryEditor,
              dbId: 1,
            },
          ],
          tabHistory: [defaultQueryEditor.id],
        },
      },
    },
  );

const waitLoadMetadataValidators = () => new Promise(r => setTimeout(r, 300));

test('should pop up the table metadata when sibling token is in the list', async () => {
  const { getByText, queryByText, findByText } = await setup({});
  expect(queryByText('table1')).not.toBeInTheDocument();
  await waitLoadMetadataValidators();
  getByText('Trigger').click();
  const popupTitle = await findByText('main.table1');
  expect(popupTitle).toBeInTheDocument();
  expect(getByText('column1')).toBeInTheDocument();
  expect(getByText('column2')).toBeInTheDocument();
});

test('should pop up the table metadata when table token is in the list', async () => {
  const { getByText, queryByText, findByText } = await setup({
    token: { type: 'table', value: 'table2', index: 0 },
    siblingTokens: [],
  });
  expect(queryByText('main.table2')).not.toBeInTheDocument();
  await waitLoadMetadataValidators();
  getByText('Trigger').click();
  const popupTitle = await findByText('main.table2');
  expect(popupTitle).toBeInTheDocument();
  expect(getByText('column1')).toBeInTheDocument();
  expect(getByText('column2')).toBeInTheDocument();
});

test('should ignore poping up when table token is not in the list', async () => {
  const { getByText, queryByText } = await setup({
    token: { type: 'table', value: 'table3', index: 0 },
    siblingTokens: [],
  });
  expect(queryByText('main.table3')).not.toBeInTheDocument();
  await waitLoadMetadataValidators();
  getByText('Trigger').click();
  expect(queryByText('main.table3')).not.toBeInTheDocument();
});
