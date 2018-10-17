import React from 'react';
import { Modal } from 'react-bootstrap';
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

const SAVE_ENDPOINT = 'glob:*/datasource/save/';
const SAVE_PAYLOAD = { new: 'data' };

describe('DatasourceModal', () => {
  const mockStore = configureStore([thunk]);
  const store = mockStore({});
  fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);

  let wrapper;
  let el;
  let inst;

  beforeEach(() => {
    el = <DatasourceModal {...props} />;
    wrapper = shallow(el, { context: { store } }).dive();
    inst = wrapper.instance();
  });

  it('is valid', () => {
    expect(React.isValidElement(el)).toBe(true);
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toHaveLength(1);
  });

  it('renders a DatasourceEditor', () => {
    expect(wrapper.find(DatasourceEditor)).toHaveLength(1);
  });

  it('saves on confirm', (done) => {
    inst.onConfirmSave();
    setTimeout(() => {
      expect(fetchMock.calls(SAVE_ENDPOINT)).toHaveLength(1);
      expect(props.onDatasourceSave.getCall(0).args[0]).toEqual(SAVE_PAYLOAD);
      fetchMock.reset();
      done();
    }, 0);
  });
});
