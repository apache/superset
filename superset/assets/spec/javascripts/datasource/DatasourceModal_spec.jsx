import React from 'react';
import { Modal } from 'react-bootstrap';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import sinon from 'sinon';

import DatasourceModal from '../../../src/datasource/DatasourceModal';
import DatasourceEditor from '../../../src/datasource/DatasourceEditor';
import mockDatasource from '../../fixtures/mockDatasource';

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
  show: true,
  onHide: () => {},
  onDatasourceSave: sinon.spy(),
};

const saveEndpoint = 'glob:*/datasource/save/';
const savePayload = { new: 'data' };

describe('DatasourceModal', () => {
  const mockStore = configureStore([thunk]);
  const store = mockStore({});
  fetchMock.post(saveEndpoint, savePayload);

  let wrapper;
  let el;
  let inst;

  beforeEach(() => {
    el = <DatasourceModal {...props} />;
    wrapper = shallow(el, { context: { store } }).dive();
    inst = wrapper.instance();
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

  it('saves on confirm', (done) => {
    inst.onConfirmSave();
    setTimeout(() => {
      expect(fetchMock.calls(saveEndpoint)).to.have.lengthOf(1);
      expect(props.onDatasourceSave.getCall(0).args[0]).to.deep.equal(savePayload);
      fetchMock.reset();
      done();
    }, 0);
  });
});
