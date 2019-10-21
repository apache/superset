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
import { shallow } from 'enzyme';
import { Nav } from 'react-bootstrap';

import Menu from '../../../src/components/Menu/Menu';

const defaultProps = {
  data: {
    menu: [
      {
        name: 'Security',
        icon: 'fa-cogs',
        label: 'Security',
        childs: [
          {
            name: 'List Users',
            icon: 'fa-user',
            label: 'List Users',
            url: '/users/list/',
          },
        ],
      },
      {
        name: 'Sources',
        icon: 'fa-table',
        label: 'Sources',
        childs: [
          {
            name: 'Tables',
            icon: 'fa-table',
            label: 'Tables',
            url: '/tablemodelview/list/?_flt_1_is_sqllab_view=y',
          },
          '-',
          {
            name: 'Databases',
            icon: 'fa-database',
            label: 'Databases',
            url: '/databaseview/list/',
          },
        ],
      },
      {
        name: 'Charts',
        icon: 'fa-bar-chart',
        label: 'Charts',
        url: '/chart/list/',
      },
      {
        name: 'Dashboards',
        icon: 'fa-dashboard',
        label: 'Dashboards',
        url: '/dashboard/list/',
      },
    ],
    brand: {
      path: '/superset/profile/admin/',
      icon: '/static/assets/images/superset-logo@2x.png',
      alt: 'Superset',
    },
    navbar_right: {
      bug_report_url: null,
      documentation_url: null,
      languages: {
        en: {
          flag: 'us',
          name: 'English',
          url: '/lang/en',
        },
        it: {
          flag: 'it',
          name: 'Italian',
          url: '/lang/it',
        },
      },
      show_language_picker: true,
      user_is_anonymous: false,
      user_info_url: '/users/userinfo/',
      user_logout_url: '/logout/',
      user_login_url: '/login/',
      locale: 'en',
    },
  },
};

describe('Menu', () => {
  let wrapper;

  const getWrapper = (overrideProps = {}) => {
    const props = {
      ...defaultProps,
      ...overrideProps,
    };
    return shallow(<Menu {...props} />);
  };

  beforeEach(() => {
    wrapper = getWrapper();
  });

  it('renders the brand', () => {
    expect(wrapper.find('.navbar-brand')).toHaveLength(1);
  });

  it('renders 2 navs', () => {
    expect(wrapper.find(Nav)).toHaveLength(2);
  });

  it('renders a logged out view', () => {
    const loggedOutWrapper = getWrapper({
      data: {
        ...defaultProps.data,
        navbar_right: {
          ...defaultProps.data.navbar_right,
          user_is_anonymous: true,
        },
      },
    });
    expect(loggedOutWrapper.find('i.fa-sign-in')).toHaveLength(1);
    expect(loggedOutWrapper.find('i.fa-user')).toHaveLength(0);
  });
});
