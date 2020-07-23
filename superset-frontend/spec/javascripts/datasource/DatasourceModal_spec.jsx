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
import { Modal } from 'react-bootstrap';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import sinon from 'sinon';

import DatasourceModal from 'src/datasource/DatasourceModal';
import DatasourceEditor from 'src/datasource/DatasourceEditor';
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

  it('saves on confirm', () => {
    return new Promise(done => {
      inst.onConfirmSave();
      setTimeout(() => {
        expect(fetchMock.calls(SAVE_ENDPOINT)).toHaveLength(1);
        expect(props.onDatasourceSave.getCall(0).args[0]).toEqual(SAVE_PAYLOAD);
        fetchMock.reset();
        done();
      }, 0);
    });
  });
});
