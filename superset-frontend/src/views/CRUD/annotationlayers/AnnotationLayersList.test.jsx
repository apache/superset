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
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import { styledMount as mount } from 'spec/helpers/theming';

import AnnotationLayersList from 'src/views/CRUD/annotationlayers/AnnotationLayersList';
import AnnotationLayerModal from 'src/views/CRUD/annotationlayers/AnnotationLayerModal';
import SubMenu from 'src/views/components/SubMenu';
import ListView from 'src/components/ListView';
import Filters from 'src/components/ListView/Filters';
import DeleteModal from 'src/components/DeleteModal';
import Button from 'src/components/Button';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { act } from 'react-dom/test-utils';

// store needed for withToasts(AnnotationLayersList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const layersInfoEndpoint = 'glob:*/api/v1/annotation_layer/_info*';
const layersEndpoint = 'glob:*/api/v1/annotation_layer/?*';
const layerEndpoint = 'glob:*/api/v1/annotation_layer/*';
const layersRelatedEndpoint = 'glob:*/api/v1/annotation_layer/related/*';

const mocklayers = [...new Array(3)].map((_, i) => ({
  changed_on_delta_humanized: `${i} day(s) ago`,
  created_by: {
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: new Date().toISOString,
  changed_on: new Date().toISOString,
  id: i,
  name: `layer ${i}`,
  desc: 'layer description',
}));

const mockUser = {
  userId: 1,
};

fetchMock.get(layersInfoEndpoint, {
  permissions: ['can_write'],
});
fetchMock.get(layersEndpoint, {
  result: mocklayers,
  layers_count: 3,
});

fetchMock.delete(layerEndpoint, {});
fetchMock.delete(layersEndpoint, {});

fetchMock.get(layersRelatedEndpoint, {
  created_by: {
    count: 0,
    result: [],
  },
});

describe('AnnotationLayersList', () => {
  const wrapper = mount(
    <Provider store={store}>
      <AnnotationLayersList store={store} user={mockUser} />
    </Provider>,
  );
  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  it('renders', () => {
    expect(wrapper.find(AnnotationLayersList)).toExist();
  });

  it('renders a SubMenu', () => {
    expect(wrapper.find(SubMenu)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('renders a modal', () => {
    expect(wrapper.find(AnnotationLayerModal)).toExist();
  });

  it('fetches layers', () => {
    const callsQ = fetchMock.calls(/annotation_layer\/\?q/);
    expect(callsQ).toHaveLength(1);
    expect(callsQ[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/annotation_layer/?q=(order_column:name,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('renders Filters', () => {
    expect(wrapper.find(Filters)).toExist();
  });

  it('searches', async () => {
    const filtersWrapper = wrapper.find(Filters);
    act(() => {
      filtersWrapper.find('[name="name"]').first().props().onSubmit('foo');
    });
    await waitForComponentToPaint(wrapper);

    expect(fetchMock.lastCall()[0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/annotation_layer/?q=(filters:!((col:name,opr:ct,value:foo)),order_column:name,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('deletes', async () => {
    act(() => {
      wrapper.find('[data-test="delete-action"]').first().props().onClick();
    });
    await waitForComponentToPaint(wrapper);

    expect(
      wrapper.find(DeleteModal).first().props().description,
    ).toMatchInlineSnapshot(`"This action will permanently delete the layer."`);

    act(() => {
      wrapper
        .find('#delete')
        .first()
        .props()
        .onChange({ target: { value: 'DELETE' } });
    });
    await waitForComponentToPaint(wrapper);
    act(() => {
      wrapper.find('button').last().props().onClick();
    });

    await waitForComponentToPaint(wrapper);

    expect(fetchMock.calls(/annotation_layer\/0/, 'DELETE')).toHaveLength(1);
  });

  it('shows/hides bulk actions when bulk actions is clicked', async () => {
    const button = wrapper.find(Button).at(1);
    act(() => {
      button.props().onClick();
    });
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(IndeterminateCheckbox)).toHaveLength(
      mocklayers.length + 1, // 1 for each row and 1 for select all
    );
  });
});
