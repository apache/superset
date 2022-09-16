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
import { Store } from 'redux';

import { render, fireEvent, waitFor } from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import RunQueryActionButton, {
  Props,
} from 'src/SqlLab/components/RunQueryActionButton';

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

const defaultProps = {
  queryEditor: defaultQueryEditor,
  allowAsync: false,
  dbId: 1,
  queryState: 'ready',
  runQuery: jest.fn(),
  selectedText: null,
  stopQuery: jest.fn(),
  overlayCreateAsMenu: null,
};

const setup = (props?: Partial<Props>, store?: Store) =>
  render(<RunQueryActionButton {...defaultProps} {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

describe('RunQueryActionButton', () => {
  beforeEach(() => {
    defaultProps.runQuery.mockReset();
    defaultProps.stopQuery.mockReset();
  });

  it('renders a single Button', () => {
    const { getByRole } = setup({}, mockStore(initialState));
    expect(getByRole('button')).toBeInTheDocument();
  });

  it('renders a label for Run Query', () => {
    const { getByText } = setup({}, mockStore(initialState));
    expect(getByText('Run')).toBeInTheDocument();
  });

  it('renders a label for Selected Query', () => {
    const { getByText } = setup(
      {},
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            selectedText: 'FROM',
          },
        },
      }),
    );
    expect(getByText('Run selection')).toBeInTheDocument();
  });

  it('disable button when sql from unsaved changes is empty', () => {
    const { getByRole } = setup(
      {},
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            sql: '',
          },
        },
      }),
    );
    const button = getByRole('button');
    expect(button).toBeDisabled();
  });

  it('enable default button for unrelated unsaved changes', () => {
    const { getByRole } = setup(
      {},
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: `${defaultQueryEditor.id}-other`,
            sql: '',
          },
        },
      }),
    );
    const button = getByRole('button');
    expect(button).toBeEnabled();
  });

  it('dispatch runQuery on click', async () => {
    const { getByRole } = setup({}, mockStore(initialState));
    const button = getByRole('button');
    expect(defaultProps.runQuery).toHaveBeenCalledTimes(0);
    fireEvent.click(button);
    await waitFor(() => expect(defaultProps.runQuery).toHaveBeenCalledTimes(1));
  });

  describe('on running state', () => {
    it('dispatch stopQuery on click', async () => {
      const { getByRole } = setup(
        { queryState: 'running' },
        mockStore(initialState),
      );
      const button = getByRole('button');
      expect(defaultProps.stopQuery).toHaveBeenCalledTimes(0);
      fireEvent.click(button);
      await waitFor(() =>
        expect(defaultProps.stopQuery).toHaveBeenCalledTimes(1),
      );
    });
  });
});
