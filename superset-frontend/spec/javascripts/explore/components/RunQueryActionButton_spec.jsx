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

import RunQueryActionButton from 'src/SqlLab/components/RunQueryActionButton';
import Button from 'src/components/Button';

describe('RunQueryActionButton', () => {
  let wrapper;
  const defaultProps = {
    allowAsync: false,
    dbId: 1,
    queryState: 'pending',
    runQuery: () => {}, // eslint-disable-line
    selectedText: null,
    stopQuery: () => {}, // eslint-disable-line
    sql: '',
  };

  beforeEach(() => {
    wrapper = shallow(<RunQueryActionButton {...defaultProps} />);
  });

  it('is a valid react element', () => {
    expect(
      React.isValidElement(<RunQueryActionButton {...defaultProps} />),
    ).toBe(true);
  });

  it('renders a single Button', () => {
    expect(wrapper.find(Button)).toHaveLength(1);
  });
});
