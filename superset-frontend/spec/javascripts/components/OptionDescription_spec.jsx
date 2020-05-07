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

import InfoTooltipWithTrigger from 'src/components/InfoTooltipWithTrigger';
import OptionDescription from 'src/components/OptionDescription';

const defaultProps = {
  option: {
    label: 'Some option',
    description: 'Description for some option',
  },
};

describe('OptionDescription', () => {
  let wrapper;
  let props;

  beforeEach(() => {
    props = { option: { ...defaultProps.option } };
    wrapper = shallow(<OptionDescription {...props} />);
  });

  it('renders an InfoTooltipWithTrigger', () => {
    expect(wrapper.find(InfoTooltipWithTrigger)).toHaveLength(1);
  });

  it('renders a span with the label', () => {
    expect(wrapper.find('.option-label').text()).toBe('Some option');
  });
});
