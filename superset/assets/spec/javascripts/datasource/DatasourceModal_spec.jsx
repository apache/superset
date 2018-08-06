import React from 'react';
import { Modal } from 'react-bootstrap';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import $ from 'jquery';
import sinon from 'sinon';

import DatasourceModal from '../../../src/datasource/DatasourceModal';
import DatasourceEditor from '../../../src/datasource/DatasourceEditor';
import mockDatasource from '../../fixtures/mockDatasource';

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: sinon.spy(),
  show: true,
  onHide: () => {},
};

describe('DatasourceModal', () => {
  const mockStore = configureStore([]);
  const store = mockStore({});

  let wrapper;
  let el;
  let ajaxStub;
  let inst;

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax');
    el = <DatasourceModal {...props} />;
    wrapper = shallow(el, { context: { store } }).dive();
    inst = wrapper.instance();
  });

  afterEach(() => {
    ajaxStub.restore();
  });

  it('is valid', () => {
    expect(React.isValidElement(el)).to.equal(true);
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).to.have.lengthOf(1);
  });

  it('renders a DatasourceEditor', () => {
    expect(wrapper.find(DatasourceEditor)).to.have.lengthOf(1);
  });

  it('saves on confirm', () => {
    inst.onConfirmSave();
    expect(ajaxStub.calledOnce).to.equal(true);
  });
});
