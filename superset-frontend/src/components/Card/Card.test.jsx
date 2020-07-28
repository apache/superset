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
import { mount } from 'enzyme';

import Card from './';
import {
  SupersetCard, SupersetCardGrid,
  SupersetCardMeta,
} from './Card.stories';
import { debug } from 'webpack';

describe('PopoverSection', () => {
  const defaultProps = {
    title: 'Card Title',
  };

  let wrapper;

  it('renders with no children', () => {
    expect(React.isValidElement(<Card></Card>)).toBe(true);
  });
  it('renders a title', () => {
    wrapper = mount(<SupersetCard />);
    expect(
      wrapper
        .find('.ant-card-head-title')
        .text(),
    ).toEqual('Here\'s a title!');
  });
  it('renders a child', () => {
    wrapper = mount(<Card><img /></Card>);
    expect(wrapper.find('img').length).toEqual(1);
  });
  it('renders a child', () => {
    wrapper = mount(
      <SupersetCardGrid/>,
    );
    expect(wrapper.find(Card.Grid).length).toEqual(7);
    expect(wrapper.find('.ant-card-grid').first().text()).toEqual('Content');
  });
  it('renders a child', () => {
    wrapper = mount(<SupersetCardMeta />);
    expect(wrapper.find(Card.Meta).length).toEqual(1);
    expect(wrapper.find('.ant-card-meta-title').text()).toEqual(
      'Superset Rules',
    );
  });
});