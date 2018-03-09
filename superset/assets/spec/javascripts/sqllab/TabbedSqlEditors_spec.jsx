import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import URI from 'urijs';

import { Tab } from 'react-bootstrap';
import { shallow, mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { table, initialState } from './fixtures';
import TabbedSqlEditors from '../../../javascripts/SqlLab/components/TabbedSqlEditors';
import SqlEditor from '../../../javascripts/SqlLab/components/SqlEditor';

describe('TabbedSqlEditors', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(initialState);

  const tabHistory = [
    'dfsadfs',
    'newEditorId',
  ];
  const tables = [Object.assign({}, table[0], {
    dataPreviewQueryId: 'B1-VQU1zW',
    queryEditorId: 'newEditorId',
  })];
  const queryEditors = [{
    autorun: false,
    dbId: 1,
    id: 'newEditorId',
    latestQueryId: 'B1-VQU1zW',
    schema: null,
    selectedText: null,
    sql: 'SELECT ds...',
    title: 'Untitled Query',
  }];
  const queries = {
    'B1-VQU1zW': {
      id: 'B1-VQU1zW',
      sqlEditorId: 'newEditorId',
    },
  };
  const mockedProps = {
    actions: {},
    databases: {},
    tables: [],
    queries: {},
    queryEditors: initialState.queryEditors,
    tabHistory: initialState.tabHistory,
    editorHeight: '',
    getHeight: () => ('100px'),
    database: {},
  };
  const getWrapper = () => (
    shallow(<TabbedSqlEditors {...mockedProps} />, {
      context: { store },
    }).dive());

  let wrapper;
  it('is valid', () => {
    expect(
      React.isValidElement(<TabbedSqlEditors {...mockedProps} />),
    ).to.equal(true);
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
      expect(TabbedSqlEditors.prototype.componentDidMount.calledOnce).to.equal(true);
      expect(window.history.replaceState.getCall(0).args[2])
        .to.equal('/superset/sqllab');
    });
    it('should handle savedQueryId', () => {
      uriStub.returns({ savedQueryId: 1 });
      wrapper = mount(<TabbedSqlEditors {...mockedProps} />, {
        context: { store },
      });
      expect(TabbedSqlEditors.prototype.componentDidMount.calledOnce).to.equal(true);
      expect(window.history.replaceState.getCall(0).args[2])
        .to.equal('/superset/sqllab');
    });
    it('should handle sql', () => {
      uriStub.returns({ sql: 1, dbid: 1 });
      wrapper = mount(<TabbedSqlEditors {...mockedProps} />, {
        context: { store },
      });
      expect(TabbedSqlEditors.prototype.componentDidMount.calledOnce).to.equal(true);
      expect(window.history.replaceState.getCall(0).args[2])
        .to.equal('/superset/sqllab');
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
      expect(wrapper.state().queriesArray.slice(-1)[0]).to.equal(queries['B1-VQU1zW']);
      expect(wrapper.state().dataPreviewQueries.slice(-1)[0]).to.equal(queries['B1-VQU1zW']);
    });
  });
  it('should rename Tab', () => {
    global.prompt = () => ('new title');
    wrapper = getWrapper();
    sinon.stub(wrapper.instance().props.actions, 'queryEditorSetTitle');

    wrapper.instance().renameTab(queryEditors[0]);
    expect(wrapper.instance().props.actions.queryEditorSetTitle.getCall(0).args[1]).to.equal('new title');

    delete global.prompt;
  });
  it('should removeQueryEditor', () => {
    wrapper = getWrapper();
    sinon.stub(wrapper.instance().props.actions, 'removeQueryEditor');

    wrapper.instance().removeQueryEditor(queryEditors[0]);
    expect(wrapper.instance().props.actions.removeQueryEditor.getCall(0).args[0])
      .to.equal(queryEditors[0]);
  });
  it('should add new query editor', () => {
    wrapper = getWrapper();
    sinon.stub(wrapper.instance().props.actions, 'addQueryEditor');

    wrapper.instance().newQueryEditor();
    expect(wrapper.instance().props.actions.addQueryEditor.getCall(0).args[0].title)
      .to.contain('Untitled Query');
  });
  it('should handle select', () => {
    wrapper = getWrapper();
    sinon.spy(wrapper.instance(), 'newQueryEditor');
    sinon.stub(wrapper.instance().props.actions, 'setActiveQueryEditor');

    wrapper.instance().handleSelect('add_tab');
    expect(wrapper.instance().newQueryEditor.callCount).to.equal(1);

    wrapper.instance().handleSelect('123');
    expect(wrapper.instance().props.actions.setActiveQueryEditor.getCall(0).args[0].id)
      .to.contain(123);
    wrapper.instance().newQueryEditor.restore();
  });
  it('should render', () => {
    wrapper = getWrapper();
    wrapper.setState({ hideLeftBar: true });

    const firstTab = wrapper.find(Tab).first();
    expect(firstTab.props().eventKey).to.contain(initialState.queryEditors[0].id);
    expect(firstTab.find(SqlEditor)).to.have.length(1);

    const lastTab = wrapper.find(Tab).last();
    expect(lastTab.props().eventKey).to.contain('add_tab');
  });
});
