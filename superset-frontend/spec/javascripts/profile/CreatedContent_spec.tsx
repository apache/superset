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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import CreatedContent from 'src/profile/components/CreatedContent';
import TableLoader from 'src/components/TableLoader';

import { user } from './fixtures';

// store needed for withToasts(TableLoader)
const mockStore = configureStore([thunk]);
const store = mockStore({});

describe('CreatedContent', () => {
  const mockedProps = {
    user,
  };

  it('renders 2 TableLoader', () => {
    const wrapper = shallow(<CreatedContent {...mockedProps} />, {
      context: { store },
    });
    expect(wrapper.find(TableLoader)).toHaveLength(2);
  });

  it('renders 2 titles', () => {
    const wrapper = shallow(<CreatedContent {...mockedProps} />, {
      context: { store },
    });
    expect(wrapper.find('h3')).toHaveLength(2);
  });
});
