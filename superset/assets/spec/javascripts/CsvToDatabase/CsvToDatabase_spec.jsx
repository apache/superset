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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import CsvToDatabase from 'src/CsvToDatabase/CsvToDatabase';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const databases = [{ id: -1, name: 'In a new database', allowed_schemas: [] }];

function setup() {
  return mount(<CsvToDatabase databases={databases} />, { context: { store } });
}

describe('CsvToDatabase', () => {
  it('renders without crashing', () => {
    const wrapper = setup();
    expect(wrapper.find('.container')).toHaveLength(1);
  });
});
