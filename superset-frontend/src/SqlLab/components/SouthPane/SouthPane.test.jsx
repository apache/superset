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
import { styledShallow as shallow } from 'spec/helpers/theming';
import { render, screen, act } from 'spec/helpers/testing-library';
import SouthPaneContainer from 'src/SqlLab/components/SouthPane/state';
import ResultSet from 'src/SqlLab/components/ResultSet';
import '@testing-library/jest-dom/extend-expect';
import { STATUS_OPTIONS } from 'src/SqlLab/constants';
import { initialState, table, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

const NOOP = () => {};

const mockedProps = {
  queryEditorId: defaultQueryEditor.id,
  latestQueryId: 'LCly_kkIN',
  actions: {},
  activeSouthPaneTab: '',
  height: 1,
  displayLimit: 1,
  databases: {},
  defaultQueryLimit: 100,
};

const mockedEmptyProps = {
  queryEditorId: 'random_id',
  latestQueryId: '',
  actions: {
    queryEditorSetAndSaveSql: NOOP,
    cloneQueryToNewTab: NOOP,
    fetchQueryResults: NOOP,
    clearQueryResults: NOOP,
    removeQuery: NOOP,
    setActiveSouthPaneTab: NOOP,
  },
  activeSouthPaneTab: '',
  height: 100,
  databases: '',
  displayLimit: 100,
  user: UserWithPermissionsAndRoles,
  defaultQueryLimit: 100,
};

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
        changedOn: Date.now(),
        db: 'main',
        dbId: 1,
        id: 'LCly_kkIN',
        startDttm: Date.now(),
        sqlEditorId: defaultQueryEditor.id,
      },
      lXJa7F9_r: {
        cached: false,
        changedOn: 1559238500401,
        db: 'main',
        dbId: 1,
        id: 'lXJa7F9_r',
        startDttm: 1559238500401,
        sqlEditorId: defaultQueryEditor.id,
      },
      '2g2_iRFMl': {
        cached: false,
        changedOn: 1559238506925,
        db: 'main',
        dbId: 1,
        id: '2g2_iRFMl',
        startDttm: 1559238506925,
        sqlEditorId: defaultQueryEditor.id,
      },
      erWdqEWPm: {
        cached: false,
        changedOn: 1559238516395,
        db: 'main',
        dbId: 1,
        id: 'erWdqEWPm',
        startDttm: 1559238516395,
        sqlEditorId: defaultQueryEditor.id,
      },
    },
  },
});
const setup = (overrides = {}) => (
  <SouthPaneContainer store={store} {...mockedProps} {...overrides} />
);

describe('SouthPane - Enzyme', () => {
  const getWrapper = () => shallow(setup()).dive();

  let wrapper;

  it('should render offline when the state is offline', () => {
    wrapper = getWrapper().dive();
    wrapper.setProps({ offline: true });
    expect(wrapper.childAt(0).text()).toBe(STATUS_OPTIONS.offline);
  });

  it('should pass latest query down to ResultSet component', () => {
    wrapper = getWrapper().dive();
    expect(wrapper.find(ResultSet)).toExist();
    // for editorQueries
    expect(wrapper.find(ResultSet).first().props().query.id).toEqual(
      mockedProps.latestQueryId,
    );
    // for dataPreviewQueries
    expect(wrapper.find(ResultSet).last().props().query.id).toEqual(
      '2g2_iRFMl',
    );
  });
});

describe('SouthPane - RTL', () => {
  const renderAndWait = overrides => {
    const mounted = act(async () => {
      render(setup(overrides));
    });

    return mounted;
  };
  it('Renders an empty state for results', async () => {
    await renderAndWait(mockedEmptyProps);

    const emptyStateText = screen.getByText(/run a query to display results/i);

    expect(emptyStateText).toBeVisible();
  });
});
