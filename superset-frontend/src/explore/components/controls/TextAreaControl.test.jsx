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
import sinon from 'sinon';
import { styledMount as mount } from 'spec/helpers/theming';
import { TextAreaEditor } from 'src/components/AsyncAceEditor';
import { TextArea } from 'src/components/Input';

import TextAreaControl from 'src/explore/components/controls/TextAreaControl';

const defaultProps = {
  name: 'x_axis_label',
  label: 'X Axis Label',
  onChange: sinon.spy(),
};

describe('TextArea', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = mount(<TextAreaControl {...defaultProps} />);
  });

  it('renders a FormControl', () => {
    expect(wrapper.find(TextArea)).toExist();
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find(TextArea);
    select.simulate('change', { target: { value: 'x' } });
    expect(defaultProps.onChange.calledWith('x')).toBe(true);
  });

  it('renders a AceEditor when language is specified', () => {
    const props = { ...defaultProps };
    props.language = 'markdown';
    wrapper = mount(<TextAreaControl {...props} />);
    expect(wrapper.find(TextArea)).not.toExist();
    expect(wrapper.find(TextAreaEditor)).toExist();
  });

  it('calls onAreaEditorChange when entering in the AceEditor', () => {
    const props = { ...defaultProps };
    props.language = 'markdown';
    wrapper = mount(<TextAreaControl {...props} />);
    wrapper.simulate('change', { target: { value: 'x' } });
    expect(defaultProps.onChange.calledWith('x')).toBe(true);
  });
});
