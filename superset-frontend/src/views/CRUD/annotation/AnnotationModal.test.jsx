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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { Provider } from 'react-redux';
import fetchMock from 'fetch-mock';
import AnnotationModal from 'src/views/CRUD/annotation/AnnotationModal';
import Modal from 'src/components/Modal';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { JsonEditor } from 'src/components/AsyncAceEditor';
import { styledMount as mount } from 'spec/helpers/theming';

const mockData = {
  id: 1,
  short_descr: 'annotation 1',
  start_dttm: '2019-07-01T10:25:00',
  end_dttm: '2019-06-11T10:25:00',
};

const FETCH_ANNOTATION_ENDPOINT =
  'glob:*/api/v1/annotation_layer/*/annotation/*';
const ANNOTATION_PAYLOAD = { result: mockData };

fetchMock.get(FETCH_ANNOTATION_ENDPOINT, ANNOTATION_PAYLOAD);

const mockStore = configureStore([thunk]);
const store = mockStore({});

const mockedProps = {
  addDangerToast: () => {},
  addSuccessToast: () => {},
  annotation: mockData,
  onAnnotationAdd: jest.fn(() => []),
  onHide: () => {},
  show: true,
};

async function mountAndWait(props = mockedProps) {
  const mounted = mount(
    <Provider store={store}>
      <AnnotationModal show {...props} />
    </Provider>,
  );
  await waitForComponentToPaint(mounted);
  return mounted;
}

describe('AnnotationModal', () => {
  let wrapper;

  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(AnnotationModal)).toExist();
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toExist();
  });

  it('renders add header when no annotation prop is included', async () => {
    const addWrapper = await mountAndWait({});
    expect(
      addWrapper.find('[data-test="annotaion-modal-title"]').text(),
    ).toEqual('Add annotation');
  });

  it('renders edit header when annotation prop is included', () => {
    expect(wrapper.find('[data-test="annotaion-modal-title"]').text()).toEqual(
      'Edit annotation',
    );
  });

  it('renders input elements for annotation name', () => {
    expect(wrapper.find('input[name="short_descr"]')).toExist();
  });

  it('renders json editor for json metadata', () => {
    expect(wrapper.find(JsonEditor)).toExist();
  });
});
