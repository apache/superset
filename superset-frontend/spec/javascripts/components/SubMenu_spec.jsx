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
import { Link } from 'react-router-dom';
import { shallow } from 'enzyme';
import { Navbar, MenuItem } from 'react-bootstrap';
import SubMenu from 'src/components/Menu/SubMenu';

const defaultProps = {
  name: 'Title',
  children: [
    {
      name: 'Page1',
      label: 'Page1',
      url: '/page1',
      usesRouter: true,
    },
    {
      name: 'Page2',
      label: 'Page2',
      url: '/page2',
      usesRouter: true,
    },
    {
      name: 'Page3',
      label: 'Page3',
      url: '/page3',
      usesRouter: false,
    },
  ],
};

describe('SubMenu', () => {
  let wrapper;

  const getWrapper = (overrideProps = {}) => {
    const props = {
      ...defaultProps,
      ...overrideProps,
    };
    return shallow(<SubMenu {...props} />);
  };

  beforeEach(() => {
    wrapper = getWrapper();
  });

  it('renders a Navbar', () => {
    expect(wrapper.find(Navbar)).toExist();
  });

  it('renders 3 MenuItems (when usesRouter === false)', () => {
    expect(wrapper.find(MenuItem)).toHaveLength(3);
  });

  it('renders the menu title', () => {
    expect(wrapper.find(Navbar.Brand)).toExist();
    expect(wrapper.find(Navbar.Brand).children().text()).toEqual('Title');
  });

  it('renders Link components when usesRouter === true', () => {
    const overrideProps = {
      usesRouter: true,
    };

    const routerWrapper = getWrapper(overrideProps);

    expect(routerWrapper.find(Link)).toExist();
    expect(routerWrapper.find(Link)).toHaveLength(2);
    expect(routerWrapper.find(MenuItem)).toHaveLength(1);
  });
});
