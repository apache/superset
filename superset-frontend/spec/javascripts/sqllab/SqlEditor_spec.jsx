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
import { mount } from 'enzyme';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';

import {
  SQL_EDITOR_GUTTER_HEIGHT,
  SQL_EDITOR_GUTTER_MARGIN,
  SQL_TOOLBAR_HEIGHT,
} from 'src/SqlLab/constants';
import AceEditorWrapper from 'src/SqlLab/components/AceEditorWrapper';
import ConnectedSouthPane from 'src/SqlLab/components/SouthPane';
import SqlEditor from 'src/SqlLab/components/SqlEditor';
import SqlEditorLeftBar from 'src/SqlLab/components/SqlEditorLeftBar';
import { Dropdown } from 'src/common/components';
import { queryEditorSetSelectedText } from 'src/SqlLab/actions/sqlLab';

import { initialState, queries, table } from './fixtures';

const MOCKED_SQL_EDITOR_HEIGHT = 500;

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const store = mockStore(initialState);

describe('SqlEditor', () => {
  const mockedProps = {
    actions: { queryEditorSetSelectedText },
    database: {},
    queryEditorId: initialState.sqlLab.queryEditors[0].id,
    latestQuery: queries[0],
    tables: [table],
    getHeight: () => '100px',
    editorQueries: [],
    dataPreviewQueries: [],
    defaultQueryLimit: 1000,
    maxRow: 100000,
    displayLimit: 100,
  };

  const buildWrapper = (props = {}) =>
    mount(
      <Provider store={store}>
        <SqlEditor {...mockedProps} {...props} />
      </Provider>,
      {
        wrappingComponent: ThemeProvider,
        wrappingComponentProps: { theme: supersetTheme },
      },
    );

  it('render a SqlEditorLeftBar', () => {
    const wrapper = buildWrapper();
    expect(wrapper.find(SqlEditorLeftBar)).toExist();
  });
  it('render an AceEditorWrapper', () => {
    const wrapper = buildWrapper();
    expect(wrapper.find(AceEditorWrapper)).toExist();
  });
  it('render a SouthPane', () => {
    const wrapper = buildWrapper();
    expect(wrapper.find(ConnectedSouthPane)).toExist();
  });
  // TODO eschutho convert tests to RTL
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('does not overflow the editor window', () => {
    const wrapper = buildWrapper();
    const totalSize =
      parseFloat(wrapper.find(AceEditorWrapper).props().height) +
      wrapper.find(ConnectedSouthPane).props().height +
      SQL_TOOLBAR_HEIGHT +
      SQL_EDITOR_GUTTER_MARGIN * 2 +
      SQL_EDITOR_GUTTER_HEIGHT;
    expect(totalSize).toEqual(MOCKED_SQL_EDITOR_HEIGHT);
  });
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('does not overflow the editor window after resizing', () => {
    const wrapper = buildWrapper();
    wrapper.setState({ height: 450 });
    const totalSize =
      parseFloat(wrapper.find(AceEditorWrapper).props().height) +
      wrapper.find(ConnectedSouthPane).props().height +
      SQL_TOOLBAR_HEIGHT +
      SQL_EDITOR_GUTTER_MARGIN * 2 +
      SQL_EDITOR_GUTTER_HEIGHT;
    expect(totalSize).toEqual(450);
  });
  it('render a Limit Dropdown', () => {
    const defaultQueryLimit = 101;
    const updatedProps = { ...mockedProps, defaultQueryLimit };
    const wrapper = buildWrapper(updatedProps);
    expect(wrapper.find(Dropdown)).toExist();
  });
});
