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
import {
  render,
  fireEvent,
  getByText,
  waitFor,
} from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';

import TemplateParamsEditor, {
  TemplateParamsEditorProps,
} from 'src/SqlLab/components/TemplateParamsEditor';

jest.mock('src/components/DeprecatedSelect', () => () => (
  <div data-test="mock-deprecated-select" />
));
jest.mock('src/components/Select/Select', () => () => (
  <div data-test="mock-deprecated-select-select" />
));
jest.mock('src/components/Select/AsyncSelect', () => () => (
  <div data-test="mock-async-select" />
));
jest.mock('src/components/AsyncAceEditor', () => ({
  ConfigEditor: ({ value }: { value: string }) => (
    <div data-test="mock-async-ace-editor">{value}</div>
  ),
}));

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const setup = (
  otherProps: Partial<TemplateParamsEditorProps> = {},
  store?: Store,
) =>
  render(
    <TemplateParamsEditor
      language="json"
      onChange={() => {}}
      queryEditorId={defaultQueryEditor.id}
      {...otherProps}
    />,
    {
      useRedux: true,
      store: mockStore(initialState),
      ...(store && { store }),
    },
  );

describe('TemplateParamsEditor', () => {
  it('should render with a title', () => {
    const { container } = setup();
    expect(container.querySelector('div[role="button"]')).toBeInTheDocument();
  });

  it('should open a modal with the ace editor', async () => {
    const { container, getByTestId } = setup();
    fireEvent.click(getByText(container, 'Parameters'));
    await waitFor(() => {
      expect(getByTestId('mock-async-ace-editor')).toBeInTheDocument();
    });
  });

  it('renders templateParams', async () => {
    const { container, getByTestId } = setup();
    fireEvent.click(getByText(container, 'Parameters'));
    await waitFor(() => {
      expect(getByTestId('mock-async-ace-editor')).toBeInTheDocument();
    });
    expect(getByTestId('mock-async-ace-editor')).toHaveTextContent(
      defaultQueryEditor.templateParams,
    );
  });

  it('renders code from unsaved changes', async () => {
    const expectedCode = 'custom code value';
    const { container, getByTestId } = setup(
      {},
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            templateParams: expectedCode,
          },
        },
      }),
    );
    fireEvent.click(getByText(container, 'Parameters'));
    await waitFor(() => {
      expect(getByTestId('mock-async-ace-editor')).toBeInTheDocument();
    });
    expect(getByTestId('mock-async-ace-editor')).toHaveTextContent(
      expectedCode,
    );
  });
});
