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
import { render } from 'spec/helpers/testing-library';
import { Store } from 'redux';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';

import EstimateQueryCostButton, {
  EstimateQueryCostButtonProps,
} from 'src/SqlLab/components/EstimateQueryCostButton';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

jest.mock('src/components/DeprecatedSelect', () => () => (
  <div data-test="mock-deprecated-select" />
));
jest.mock('src/components/Select/Select', () => () => (
  <div data-test="mock-deprecated-select-select" />
));
jest.mock('src/components/Select/AsyncSelect', () => () => (
  <div data-test="mock-deprecated-async-select" />
));

const setup = (props: Partial<EstimateQueryCostButtonProps>, store?: Store) =>
  render(
    <EstimateQueryCostButton
      queryEditor={defaultQueryEditor}
      getEstimate={jest.fn()}
      {...props}
    />,
    {
      useRedux: true,
      ...(store && { store }),
    },
  );

describe('EstimateQueryCostButton', () => {
  it('renders EstimateQueryCostButton', async () => {
    const { queryByText } = setup({}, mockStore(initialState));

    expect(queryByText('Estimate cost')).toBeTruthy();
  });

  it('renders label for selected query', async () => {
    const queryEditorWithSelectedText = {
      ...defaultQueryEditor,
      selectedText: 'SELECT',
    };
    const { queryByText } = setup(
      { queryEditor: queryEditorWithSelectedText },
      mockStore(initialState),
    );

    expect(queryByText('Estimate selected query cost')).toBeTruthy();
  });

  it('renders label for selected query from unsaved', async () => {
    const { queryByText } = setup(
      {},
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            selectedText: 'SELECT',
          },
        },
      }),
    );

    expect(queryByText('Estimate selected query cost')).toBeTruthy();
  });
});
