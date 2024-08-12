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
import { styledMount as mount } from 'spec/helpers/theming';
import fetchMock from 'fetch-mock';

import ListViewCard from 'src/components/ListViewCard';
import ImageLoader from 'src/components/ListViewCard/ImageLoader';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';

global.URL.createObjectURL = jest.fn(() => '/local_url');
fetchMock.get('/thumbnail', { body: new Blob(), sendAsJson: false });

describe('ListViewCard', () => {
  const defaultProps = {
    title: 'Card Title',
    loading: false,
    url: '/card-url',
    imgURL: '/thumbnail',
    imgFallbackURL: '/fallback',
    description: 'Card Description',
    coverLeft: 'Left Text',
    coverRight: 'Right Text',
    actions: (
      <ListViewCard.Actions>
        <div>Action 1</div>
        <div>Action 2</div>
      </ListViewCard.Actions>
    ),
  };

  let wrapper;
  const factory = (extraProps = {}) => {
    const props = { ...defaultProps, ...extraProps };
    return mount(<ListViewCard {...props} />);
  };
  beforeEach(async () => {
    wrapper = factory();
    await waitForComponentToPaint(wrapper);
  });

  it('is a valid element', () => {
    expect(wrapper.find(ListViewCard)).toExist();
  });

  it('renders Actions', () => {
    expect(wrapper.find(ListViewCard.Actions)).toExist();
  });

  it('renders and ImageLoader', () => {
    expect(wrapper.find(ImageLoader)).toExist();
  });
});
