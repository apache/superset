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
import { Tab } from 'react-bootstrap';
import { shallow, mount } from 'enzyme';
import sinon from 'sinon';
import TabbedSqlEditors from 'src/SqlLab/components/TabbedSqlEditors';
import SqlEditor from 'src/SqlLab/components/SqlEditor';

import { table, initialState } from './fixtures';

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
    shallow(<TabbedSqlEditors {...mockedProps} />, {
      context: { store },
    }).dive();

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
      sinon.spy(TabbedSqlEditors.prototype, 'componentDidMount');
      uriStub = sinon.stub(URI.prototype, 'search');
    });
    afterEach(() => {
      window.history.replaceState.restore();
      TabbedSqlEditors.prototype.componentDidMount.restore();
      uriStub.restore();
    });
    it('should handle id', () => {
      uriStub.returns({ id: 1 });
      wrapper = mount(<TabbedSqlEditors {...mockedProps} />, {
        context: { store },
      });
      expect(TabbedSqlEditors.prototype.componentDidMount.calledOnce).toBe(
        true,
      );
      expect(window.history.replaceState.getCall(0).args[2]).toBe(
        '/superset/sqllab',
      );
    });
    it('should handle savedQueryId', () => {
      uriStub.returns({ savedQueryId: 1 });
      wrapper = mount(<TabbedSqlEditors {...mockedProps} />, {
        context: { store },
      });
      expect(TabbedSqlEditors.prototype.componentDidMount.calledOnce).toBe(
        true,
      );
      expect(window.history.replaceState.getCall(0).args[2]).toBe(
        '/superset/sqllab',
      );
    });
    it('should handle sql', () => {
      uriStub.returns({ sql: 1, dbid: 1 });
      wrapper = mount(<TabbedSqlEditors {...mockedProps} />, {
        context: { store },
      });
      expect(TabbedSqlEditors.prototype.componentDidMount.calledOnce).toBe(
        true,
      );
      expect(window.history.replaceState.getCall(0).args[2]).toBe(
        '/superset/sqllab',
      );
    });
  });
  describe('componentWillReceiveProps', () => {
    let spy;
    beforeEach(() => {
      wrapper = getWrapper();
      spy = sinon.spy(TabbedSqlEditors.prototype, 'componentWillReceiveProps');
      wrapper.setProps({ queryEditors, queries, tabHistory, tables });
    });
    afterEach(() => {
      spy.restore();
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
    sinon.spy(wrapper.instance(), 'newQueryEditor');
    sinon.stub(wrapper.instance().props.actions, 'switchQueryEditor');

    wrapper.instance().handleSelect('add_tab', mockEvent);
    expect(wrapper.instance().newQueryEditor.callCount).toBe(1);

    // cannot switch to current tab, switchQueryEditor never gets called
    wrapper.instance().handleSelect('dfsadfs', mockEvent);
    expect(
      wrapper.instance().props.actions.switchQueryEditor.callCount,
    ).toEqual(0);
    wrapper.instance().newQueryEditor.restore();
  });
  it('should render', () => {
    wrapper = getWrapper();
    wrapper.setState({ hideLeftBar: true });

    const firstTab = wrapper.find(Tab).first();
    expect(firstTab.props().eventKey).toContain(
      initialState.sqlLab.queryEditors[0].id,
    );
    expect(firstTab.find(SqlEditor)).toHaveLength(1);

    const lastTab = wrapper.find(Tab).last();
    expect(lastTab.props().eventKey).toContain('add_tab');
  });
  it('should disable new tab when offline', () => {
    wrapper = getWrapper();
    expect(wrapper.find(Tab).last().props().disabled).toBe(false);
    wrapper.setProps({ offline: true });
    expect(wrapper.find(Tab).last().props().disabled).toBe(true);
  });
});
