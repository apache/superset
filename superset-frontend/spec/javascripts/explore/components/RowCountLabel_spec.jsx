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

import Label from 'src/components/Label';
import { Tooltip } from 'src/components/Tooltip';
import RowCountLabel from 'src/explore/components/RowCountLabel';

describe('RowCountLabel', () => {
  const defaultProps = {
    rowcount: 51,
    limit: 100,
  };

  it('is valid', () => {
    expect(React.isValidElement(<RowCountLabel {...defaultProps} />)).toBe(
      true,
    );
  });
  it('renders a Label and a Tooltip', () => {
    const wrapper = shallow(<RowCountLabel {...defaultProps} />);
    expect(wrapper.find(Label)).toExist();
    expect(wrapper.find(Tooltip)).toExist();
  });
  it('renders a danger when limit is reached', () => {
    const props = {
      rowcount: 100,
      limit: 100,
    };
    const wrapper = shallow(<RowCountLabel {...props} />);
    expect(wrapper.find(Label).first().props().type).toBe('danger');
  });
});
