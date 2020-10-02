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
import sinon from 'sinon';

import QueryAndSaveButtons from 'src/explore/components/QueryAndSaveBtns';
import Button from 'src/components/Button';

describe('QueryAndSaveButtons', () => {
  const defaultProps = {
    canAdd: true,
    onQuery: sinon.spy(),
  };

  // It must render
  it('renders', () => {
    expect(
      React.isValidElement(<QueryAndSaveButtons {...defaultProps} />),
    ).toBe(true);
  });

  // Test the output
  describe('output', () => {
    let wrapper;

    beforeEach(() => {
      wrapper = shallow(<QueryAndSaveButtons {...defaultProps} />);
    });

    it('renders 2 buttons', () => {
      expect(wrapper.find(Button)).toHaveLength(2);
    });

    it('renders buttons with correct text', () => {
      expect(wrapper.find(Button).contains('Run')).toBe(true);
      expect(wrapper.find(Button).contains(' Save')).toBe(true);
    });

    it('calls onQuery when query button is clicked', () => {
      const queryButton = wrapper.find('[data-test="run-query-button"]');
      queryButton.simulate('click');
      expect(defaultProps.onQuery.called).toBe(true);
    });
  });
});
