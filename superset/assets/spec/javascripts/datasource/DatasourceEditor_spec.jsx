import React from 'react';
import { Tabs } from 'react-bootstrap';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import configureStore from 'redux-mock-store';
import $ from 'jquery';
import sinon from 'sinon';

import DatasourceEditor from '../../../src/datasource/DatasourceEditor';
import mockDatasource from '../../fixtures/mockDatasource';

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: sinon.spy(),
};
const extraColumn = {
  column_name: 'new_column',
  type: 'VARCHAR(10)',
  description: null,
  filterable: true,
  verbose_name: null,
  is_dttm: false,
  expression: '',
  groupby: true,
};

describe('DatasourceEditor', () => {
  const mockStore = configureStore([]);
  const store = mockStore({});

  let wrapper;
  let el;
  let ajaxStub;
  let inst;

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax');
    el = <DatasourceEditor {...props} />;
    wrapper = shallow(el, { context: { store } }).dive();
    inst = wrapper.instance();
  });

  afterEach(() => {
    ajaxStub.restore();
  });

  it('is valid', () => {
    expect(React.isValidElement(el)).to.equal(true);
  });

  it('renders Tabs', () => {
    expect(wrapper.find(Tabs)).to.have.lengthOf(1);
  });

  it('makes an async request', () => {
    wrapper.setState({ activeTabKey: 2 });
    const syncButton = wrapper.find('.sync-from-source');
    expect(syncButton).to.have.lengthOf(1);
    syncButton.simulate('click');
    expect(ajaxStub.calledOnce).to.equal(true);
  });

  it('merges columns', () => {
    const numCols = props.datasource.columns.length;
    expect(inst.state.databaseColumns.length).to.equal(numCols);
    inst.mergeColumns([extraColumn]);
    expect(inst.state.databaseColumns.length).to.equal(numCols + 1);
  });

});
