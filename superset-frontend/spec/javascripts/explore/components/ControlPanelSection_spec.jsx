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
import { Panel } from 'react-bootstrap';
import { InfoTooltipWithTrigger } from '@superset-ui/control-utils';
import ControlPanelSection from 'src/explore/components/ControlPanelSection';

const defaultProps = {
  children: <div>a child element</div>,
};

const optionalProps = {
  label: 'my label',
  description: 'my description',
  tooltip: 'my tooltip',
};

describe('ControlPanelSection', () => {
  let wrapper;
  let props;
  it('is a valid element', () => {
    expect(
      React.isValidElement(<ControlPanelSection {...defaultProps} />),
    ).toBe(true);
  });

  it('renders a Panel component', () => {
    wrapper = shallow(<ControlPanelSection {...defaultProps} />);
    expect(wrapper.find(Panel)).toHaveLength(1);
  });

  describe('with optional props', () => {
    beforeEach(() => {
      props = Object.assign(defaultProps, optionalProps);
      wrapper = shallow(<ControlPanelSection {...props} />);
    });

    it('renders a label if present', () => {
      expect(wrapper.find(Panel.Title).dive().text()).toContain('my label');
    });

    it('renders a InfoTooltipWithTrigger if label and tooltip is present', () => {
      expect(
        wrapper.find(Panel).dive().find(InfoTooltipWithTrigger),
      ).toHaveLength(1);
    });
  });
});
