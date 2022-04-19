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
import URI from 'urijs';
import { Provider } from 'react-redux';
import { shallow, mount } from 'enzyme';
import sinon from 'sinon';
import { act } from 'react-dom/test-utils';
import fetchMock from 'fetch-mock';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { EditableTabs } from 'src/components/Tabs';
import TabbedSqlEditors from 'src/SqlLab/components/TabbedSqlEditors';
import SqlEditor from 'src/SqlLab/components/SqlEditor';
import { table, initialState } from 'src/SqlLab/fixtures';

fetchMock.get('glob:*/api/v1/database/*', {});
fetchMock.get('glob:*/savedqueryviewapi/api/get/*', {});
fetchMock.get('glob:*/kv/*', {});

describe('TabbedSqlEditors', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(initialState);

  const tabHistory = ['dfsadfs', 'newEditorId'];

  const tables = [
    { ...table, dataPreviewQueryId: 'B1-VQU1zW', queryEditorId: 'newEditorId' },
  ];

  const queryEditors = [
    {
      autorun: false,
      dbId: 1,
      id: 'newEditorId',
      latestQueryId: 'B1-VQU1zW',
      schema: null,
      selectedText: null,
      sql: 'SELECT ds...',
      title: 'Untitled Query',
    },
  ];
  const queries = {
    'B1-VQU1zW': {
      id: 'B1-VQU1zW',
      sqlEditorId: 'newEditorId',
      tableName: 'ab_user',
      state: 'success',
    },
  };
  const mockedProps = {
    actions: {},
    databases: {},
    tables: [],
    queries: {},
    queryEditors: initialState.sqlLab.queryEditors,
    tabHistory: initialState.sqlLab.tabHistory,
    editorHeight: '',
    getHeight: () => '100px',
    database: {},
    defaultQueryLimit: 1000,
    maxRow: 100000,
  };
  const getWrapper = () =>
    shallow(<TabbedSqlEditors store={store} {...mockedProps} />)
      .dive()
      .dive();

  const mountWithAct = async () =>
    act(async () => {
      mount(
        <Provider store={store}>
          <TabbedSqlEditors {...mockedProps} />
        </Provider>,
        {
          wrappingComponent: ThemeProvider,
          wrappingComponentProps: { theme: supersetTheme },
        },
      );
    });

  let wrapper;
  it('is valid', () => {
    expect(React.isValidElement(<TabbedSqlEditors {...mockedProps} />)).toBe(
      true,
    );
  });
  describe('componentDidMount', () => {
    let uriStub;
    beforeEach(() => {
      sinon.stub(window.history, 'replaceState');
      uriStub = sinon.stub(URI.prototype, 'search');
    });
    afterEach(() => {
      window.history.replaceState.restore();
      uriStub.restore();
    });
    it('should handle id', async () => {
      uriStub.returns({ id: 1 });
      await mountWithAct();
      expect(window.history.replaceState.getCall(0).args[2]).toBe(
        '/superset/sqllab',
      );
    });
    it('should handle savedQueryId', async () => {
      uriStub.returns({ savedQueryId: 1 });
      await mountWithAct();
      expect(window.history.replaceState.getCall(0).args[2]).toBe(
        '/superset/sqllab',
      );
    });
    it('should handle sql', async () => {
      uriStub.returns({ sql: 1, dbid: 1 });
      await mountWithAct();
      expect(window.history.replaceState.getCall(0).args[2]).toBe(
        '/superset/sqllab',
      );
    });
  });
  describe('UNSAFE_componentWillReceiveProps', () => {
    beforeEach(() => {
      wrapper = getWrapper();
      wrapper.setProps({ queryEditors, queries, tabHistory, tables });
    });
    it('should update queriesArray and dataPreviewQueries', () => {
      expect(wrapper.state().queriesArray.slice(-1)[0]).toBe(
        queries['B1-VQU1zW'],
      );
      expect(wrapper.state().dataPreviewQueries.slice(-1)[0]).toEqual(
        queries['B1-VQU1zW'],
      );
    });
  });
  it('should rename Tab', () => {
    global.prompt = () => 'new title';
    wrapper = getWrapper();
    sinon.stub(wrapper.instance().props.actions, 'queryEditorSetTitle');

    wrapper.instance().renameTab(queryEditors[0]);
    expect(
      wrapper.instance().props.actions.queryEditorSetTitle.getCall(0).args[1],
    ).toBe('new title');

    delete global.prompt;
  });
  it('should removeQueryEditor', () => {
    wrapper = getWrapper();
    sinon.stub(wrapper.instance().props.actions, 'removeQueryEditor');

    wrapper.instance().removeQueryEditor(queryEditors[0]);
    expect(
      wrapper.instance().props.actions.removeQueryEditor.getCall(0).args[0],
    ).toBe(queryEditors[0]);
  });
  it('should add new query editor', () => {
    wrapper = getWrapper();
    sinon.stub(wrapper.instance().props.actions, 'addQueryEditor');

    wrapper.instance().newQueryEditor();
    expect(
      wrapper.instance().props.actions.addQueryEditor.getCall(0).args[0].title,
    ).toContain('Untitled Query');
  });
  it('should duplicate query editor', () => {
    wrapper = getWrapper();
    sinon.stub(wrapper.instance().props.actions, 'cloneQueryToNewTab');

    wrapper.instance().duplicateQueryEditor(queryEditors[0]);
    expect(
      wrapper.instance().props.actions.cloneQueryToNewTab.getCall(0).args[0],
    ).toBe(queryEditors[0]);
  });
  it('should handle select', () => {
    const mockEvent = {
      target: {
        getAttribute: () => null,
      },
    };
    wrapper = getWrapper();
    sinon.stub(wrapper.instance().props.actions, 'switchQueryEditor');

    // cannot switch to current tab, switchQueryEditor never gets called
    wrapper.instance().handleSelect('dfsadfs', mockEvent);
    expect(
      wrapper.instance().props.actions.switchQueryEditor.callCount,
    ).toEqual(0);
  });
  it('should handle add tab', () => {
    wrapper = getWrapper();
    sinon.spy(wrapper.instance(), 'newQueryEditor');

    wrapper.instance().handleEdit('1', 'add');
    expect(wrapper.instance().newQueryEditor.callCount).toBe(1);
    wrapper.instance().newQueryEditor.restore();
  });
  it('should render', () => {
    wrapper = getWrapper();
    wrapper.setState({ hideLeftBar: true });

    const firstTab = wrapper.find(EditableTabs.TabPane).first();
    expect(firstTab.props()['data-key']).toContain(
      initialState.sqlLab.queryEditors[0].id,
    );
    expect(firstTab.find(SqlEditor)).toHaveLength(1);
  });
  it('should disable new tab when offline', () => {
    wrapper = getWrapper();
    expect(wrapper.find(EditableTabs).props().hideAdd).toBe(false);
    wrapper.setProps({ offline: true });
    expect(wrapper.find(EditableTabs).props().hideAdd).toBe(true);
  });
});
