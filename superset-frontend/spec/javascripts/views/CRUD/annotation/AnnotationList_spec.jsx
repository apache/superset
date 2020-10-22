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
import { styledMount as mount } from 'spec/helpers/theming';

import AnnotationList from 'src/views/CRUD/annotation/AnnotationList';
import SubMenu from 'src/components/Menu/SubMenu';
import ListView from 'src/components/ListView';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';

// store needed for withToasts(AnnotationList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const annotationsEndpoint = 'glob:*/api/v1/annotation_layer/*/annotation';
const annotationLayerEndpoint = 'glob:*/api/v1/annotation_layer/*';

const mocktemplates = [...new Array(3)].map((_, i) => ({
  changed_on_delta_humanized: `${i} day(s) ago`,
  created_by: {
    first_name: `user`,
    id: i,
  },
  end_dttm: new Date().toISOString,
  id: i,
  long_descr: `annotation ${i} description`,
  short_descr: `annotation ${i} label`,
  start_dttm: new Date().toISOString,
}));

fetchMock.get(annotationsEndpoint, {
  result: mocktemplates,
  count: 3,
});

fetchMock.get(annotationLayerEndpoint, {
  id: 1,
  result: { descr: 'annotations test 0', name: 'Test 0' },
});

async function mountAndWait(props) {
  const mounted = mount(<AnnotationList {...props} />, {
    context: { store },
  });
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('AnnotationList', () => {
  let wrapper;

  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(AnnotationList)).toExist();
  });

  it('renders a SubMenu', () => {
    expect(wrapper.find(SubMenu)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('fetches annotation layer', () => {
    const callsQ = fetchMock.calls(/annotation_layer\/1/);
    expect(callsQ).toHaveLength(3);
    expect(callsQ[2][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/annotation_layer/1"`,
    );
  });

  it('fetches annotations', () => {
    const callsQ = fetchMock.calls(/annotation_layer\/1\/annotation/);
    expect(callsQ).toHaveLength(2);
    expect(callsQ[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/annotation_layer/1/annotation/?q=(order_column:short_descr,order_direction:desc,page:0,page_size:25)"`,
    );
  });
});
