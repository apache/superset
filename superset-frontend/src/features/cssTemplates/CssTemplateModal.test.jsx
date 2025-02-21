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
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import Modal from 'src/components/Modal';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { CssEditor } from 'src/components/AsyncAceEditor';
import { styledMount as mount } from 'spec/helpers/theming';
import CssTemplateModal from './CssTemplateModal';

const mockData = { id: 1, template_name: 'test' };
const FETCH_CSS_TEMPLATE_ENDPOINT = 'glob:*/api/v1/css_template/*';
const CSS_TEMPLATE_PAYLOAD = { result: mockData };

fetchMock.get(FETCH_CSS_TEMPLATE_ENDPOINT, CSS_TEMPLATE_PAYLOAD);

const mockStore = configureStore([thunk]);
const store = mockStore({});

const mockedProps = {
  addDangerToast: () => {},
  onCssTemplateAdd: jest.fn(() => []),
  onHide: () => {},
  show: true,
  cssTemplate: mockData,
};

async function mountAndWait(props = mockedProps) {
  const mounted = mount(
    <Provider store={store}>
      <CssTemplateModal show {...props} />
    </Provider>,
  );
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('CssTemplateModal', () => {
  let wrapper;

  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(CssTemplateModal)).toBeTruthy();
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toBeTruthy();
  });

  it('renders add header when no css template is included', async () => {
    const addWrapper = await mountAndWait({});
    expect(
      addWrapper.find('[data-test="css-template-modal-title"]').text(),
    ).toEqual('Add CSS template');
  });

  it('renders edit header when css template prop is included', () => {
    expect(
      wrapper.find('[data-test="css-template-modal-title"]').text(),
    ).toEqual('Edit CSS template properties');
  });

  it('renders input elements for template name', () => {
    expect(wrapper.find('input[name="template_name"]')).toBeTruthy();
  });

  it('renders css editor for css', () => {
    expect(wrapper.find(CssEditor)).toBeTruthy();
  });
});
