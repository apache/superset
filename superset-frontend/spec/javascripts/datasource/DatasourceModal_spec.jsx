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
import { act } from 'react-dom/test-utils';
import { Modal } from 'react-bootstrap';
import configureStore from 'redux-mock-store';
import { mount } from 'enzyme';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import sinon from 'sinon';
import { supersetTheme, ThemeProvider } from '@superset-ui/style';

import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import DatasourceModal from 'src/datasource/DatasourceModal';
import DatasourceEditor from 'src/datasource/DatasourceEditor';
import mockDatasource from '../../fixtures/mockDatasource';

const mockStore = configureStore([thunk]);
const store = mockStore({});
const datasource = mockDatasource['7__table'];

const SAVE_ENDPOINT = 'glob:*/api/v1/dataset/7';
const SAVE_PAYLOAD = { new: 'data' };

const mockedProps = {
  datasource,
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
  onHide: () => {},
  show: true,
  onDatasourceSave: sinon.spy(),
};

async function mountAndWait(props = mockedProps) {
  const mounted = mount(<DatasourceModal {...props} />, {
    context: { store },
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('DatasourceModal', () => {
  fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
  const callsP = fetchMock.put(SAVE_ENDPOINT, SAVE_PAYLOAD);

  let wrapper;

  beforeEach(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(DatasourceModal)).toHaveLength(1);
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toHaveLength(2);
  });

  it('renders a DatasourceEditor', () => {
    expect(wrapper.find(DatasourceEditor)).toHaveLength(1);
  });

  it('saves on confirm', async () => {
    act(() => {
      wrapper.find('[className="m-r-5"]').props().onClick();
    });
    await waitForComponentToPaint(wrapper);
    act(() => {
      const okButton = wrapper.find('[className="btn btn-sm btn-primary"]');
      okButton.simulate('click');
    });
    await waitForComponentToPaint(wrapper);
    expect(callsP._calls).toHaveLength(2); /* eslint no-underscore-dangle: 0 */
  });
});
