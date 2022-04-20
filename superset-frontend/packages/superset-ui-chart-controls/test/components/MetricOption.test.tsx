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
import { shallow, ShallowWrapper } from 'enzyme';
import { MetricOption, MetricOptionProps } from '../../src';

describe('MetricOption', () => {
  const defaultProps = {
    metric: {
      metric_name: 'foo',
      verbose_name: 'Foo',
      expression: 'SUM(foo)',
      label: 'test',
      description: 'Foo is the greatest metric of all',
      warning_text: 'Be careful when using foo',
    },
    openInNewWindow: false,
    showFormula: true,
    showType: true,
    url: '',
  };

  let wrapper: ShallowWrapper;
  let props: MetricOptionProps;
  const factory = (o: MetricOptionProps) => <MetricOption {...o} />;
  beforeEach(() => {
    wrapper = shallow(factory(defaultProps));
    props = { ...defaultProps };
  });
  it('is a valid element', () => {
    expect(React.isValidElement(<MetricOption {...defaultProps} />)).toBe(true);
  });
  it('shows a label with verbose_name', () => {
    const lbl = wrapper.find('.option-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('Foo');
  });
  it('shows a InfoTooltipWithTrigger', () => {
    expect(wrapper.find('InfoTooltipWithTrigger')).toHaveLength(1);
  });
  it('shows SQL Popover trigger', () => {
    expect(wrapper.find('SQLPopover')).toHaveLength(1);
  });
  it('shows a label with metric_name when no verbose_name', () => {
    props.metric.verbose_name = '';
    wrapper = shallow(factory(props));
    expect(wrapper.find('.option-label').first().text()).toBe('foo');
  });
  it('doesnt show InfoTooltipWithTrigger when no warning', () => {
    props.metric.warning_text = '';
    wrapper = shallow(factory(props));
    expect(wrapper.find('InfoTooltipWithTrigger')).toHaveLength(0);
  });
  it('sets target="_blank" when openInNewWindow is true', () => {
    props.url = 'https://github.com/apache/incubator-superset';
    wrapper = shallow(factory(props));
    expect(wrapper.find('a').prop('target')).toBe('');

    props.openInNewWindow = true;
    wrapper = shallow(factory(props));
    expect(wrapper.find('a').prop('target')).toBe('_blank');
  });
  it('shows a metric type label when showType is true', () => {
    props.showType = true;
    wrapper = shallow(factory(props));
    expect(wrapper.find('ColumnTypeLabel')).toHaveLength(1);
  });
  it('shows a Tooltip for the verbose metric name', () => {
    expect(wrapper.find('Tooltip')).toHaveLength(1);
  });
});
