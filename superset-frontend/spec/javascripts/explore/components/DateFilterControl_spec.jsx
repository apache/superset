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
/* eslint-disable no-unused-expressions */
import React from 'react';
import { Radio } from 'react-bootstrap';
import sinon from 'sinon';
import { styledMount as mount } from 'spec/helpers/theming';

import { Tooltip } from 'src/common/components/Tooltip';
import Popover from 'src/common/components/Popover';
import Tabs from 'src/common/components/Tabs';
import Label from 'src/components/Label';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import ControlHeader from 'src/explore/components/ControlHeader';

// Mock moment.js to use a specific date
jest.mock('moment', () => {
  const testDate = new Date('2020-09-07');

  return () => jest.requireActual('moment')(testDate);
});

const defaultProps = {
  animation: false,
  name: 'date',
  onChange: sinon.spy(),
  value: '90 days ago',
  label: 'date',
};

describe('DateFilterControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(<DateFilterControl {...defaultProps} />);
  });

  it('renders', () => {
    expect(wrapper.find(DateFilterControl)).toExist();
  });

  it('renders a ControlHeader', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);
  });

  it('renders an Popover', () => {
    expect(wrapper.find(Popover)).toExist();
  });

  it('calls open/close methods on trigger click', () => {
    const open = jest.fn();
    const close = jest.fn();
    const props = {
      ...defaultProps,
      onOpenDateFilterControl: open,
      onCloseDateFilterControl: close,
    };
    const testWrapper = mount(<DateFilterControl {...props} />);
    const label = testWrapper.find(Label).first();

    label.simulate('click');
    expect(open).toBeCalled();
    expect(close).not.toBeCalled();
    label.simulate('click');
    expect(close).toBeCalled();
  });

  it('should handle null value', () => {
    const open = jest.fn();
    const close = jest.fn();
    const props = {
      ...defaultProps,
      value: null,
      onOpenDateFilterControl: open,
      onCloseDateFilterControl: close,
    };

    expect(mount(<DateFilterControl {...props} />)).toExist();
  });

  it('renders two tabs in popover', () => {
    const popoverContent = wrapper.find(Popover).first().props().content;
    const popoverContentWrapper = mount(popoverContent);

    expect(popoverContentWrapper.find(Tabs)).toExist();
    expect(popoverContentWrapper.find(Tabs.TabPane)).toHaveLength(2);
  });

  it('renders default time options', () => {
    const popoverContent = wrapper.find(Popover).first().props().content;
    const popoverContentWrapper = mount(popoverContent);
    const defaultTab = popoverContentWrapper.find(Tabs.TabPane).first();

    expect(defaultTab.find(Radio)).toExist();
    expect(defaultTab.find(Radio)).toHaveLength(6);
  });

  it('renders tooltips over timeframe options', () => {
    const popoverContent = wrapper.find(Popover).first().props().content;
    const popoverContentWrapper = mount(popoverContent);
    const defaultTab = popoverContentWrapper.find(Tabs.TabPane).first();
    const radioTooltip = defaultTab.find(Tooltip);

    expect(radioTooltip).toExist();
    expect(radioTooltip).toHaveLength(6);
  });

  it('renders the correct time range in tooltip', () => {
    const popoverContent = wrapper.find(Popover).first().props().content;
    const popoverContentWrapper = mount(popoverContent);
    const defaultTab = popoverContentWrapper.find(Tabs.TabPane).first();
    const tooltips = defaultTab.find(Tooltip);

    expect(tooltips).toHaveLength(6);

    const expectedLabels = {
      'Last day': '2020-09-06 < col < 2020-09-07',
      'Last week': '2020-08-31 < col < 2020-09-07',
      'Last month': '2020-08-07 < col < 2020-09-07',
      'Last quarter': '2020-06-07 < col < 2020-09-07',
      'Last year': '2019-01-01 < col < 2020-01-01',
      'No filter': '-∞ < col < ∞',
    };

    tooltips.forEach(tooltip => {
      const label = tooltip.props().id.split('tooltip-')[1];

      expect(tooltip.props().title).toEqual(expectedLabels[label]);
    });
  });
});
